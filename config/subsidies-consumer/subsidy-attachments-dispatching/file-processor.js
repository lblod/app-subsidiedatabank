const fs = require('fs');
const path = require('path');
const { uuid } = require('mu');

const { 
  SECRET_KEY, 
  SYNC_BASE_URL, 
  SYNC_LOGIN_ENDPOINT
} = require("./config");
const { createFileRetry, incrementFileRetryAttempt, deleteFileEntry } = require('./queries');

// Types of operations
const DOWNLOAD_OPERATION = "download";
const DELETE_OPERATION = "delete";

// Cookie necessary to download file from producer
let cookie = null;

/**
 * 
 * DELTA FILE PROCESSOR
 * 
 * This function loops deltas and matches strings starting with:
 *  - <data:// (subsidie meta files)
 *  - <share:// (subsidie attachments)
 *  
 * When found, get a cookie from producer if needed, then either download or delete the file. 
 * Download function contains retry mechanism.
 *
 * @param {Array} termObjects - An array of delta objects to be processed.
 * @param {function} fetch - The fetch function used for network requests.
 * @param {string} operation - The operation to perform:  DOWNLOAD_OPERATION or DELETE_OPERATION.
 * @returns {Promise} A promise representing the completion of the processing.
 */
async function processFileDeltas(termObjects, fetch, operation) {
  const correlationId = uuid(); // Generate a correlation ID for this batch of operations
  console.log(`Processing file deltas with correlation ID: ${correlationId}`);
  
  const downloadPromises = termObjects.map(async (item) => {
    // Process meta files (<data://)
    if (isMetaFile(item)) {
      if (operation === DOWNLOAD_OPERATION) {
        return downloadFile(item.object.replace('<data://', '<share://subsidies/'), fetch, correlationId);
      } else if (operation === DELETE_OPERATION) {
        return deleteFile(item.object.replace('<data://', '<share://subsidies/'), correlationId);
      }
    }

    // Process attachments (<share://)
    else if (isAttachmentFile(item)) {
      if (operation === DOWNLOAD_OPERATION) {
        return downloadFile(item.subject, fetch, correlationId);
      } else if (operation === DELETE_OPERATION) {
        return deleteFile(item.subject, correlationId);
      }
    }
  });

  await Promise.all(downloadPromises);
}

/**
 * Download a file with specified URI from producer.
 * @param {string} uri - The URI of the file to be downloaded.
 * @param {function} fetcher - The fetch function to use for downloading.
 * @param {string} correlationId - The correlation ID for logging and tracking.
 * @returns {Promise} A promise representing the completion of the download.
 */
async function downloadFile(uri, fetcher, correlationId, retry = false) {
  try {
    await loginIfNeeded(correlationId);

    const fetchOptions = {
      headers: {
        cookie: cookie,
      },
    };

    uri = uri.replace(/[<>]/g, ""); // Remove gt & lt symbols "<share://uri>" -> "share://uri"

    const fileName = uri.replace('share://', '');
    const downloadFileURL = `${SYNC_BASE_URL}/delta-files-share/download?uri=${uri}`;
    const filePath = `/share/${fileName}`;

    const response = await fetcher(downloadFileURL, fetchOptions);
    const buffer = await response.buffer();
    
    await createDirectories(filePath);
    fs.writeFileSync(filePath, buffer);
    
    console.log(`File downloaded successfully: ${filePath}, Correlation ID: ${correlationId}`);

    if (retry) {
      await deleteFileEntry(uri);
      console.log(`Deleted retry entry for ${uri} after successful download`);
    }

  } catch (error) {
    console.error(`Something went wrong while downloading file ${uri}:`, error, `Correlation ID: ${correlationId}`);
    
    if(retry) {
      await incrementFileRetryAttempt(uri, error.message, correlationId);
    } else {
      await createFileRetry(uri, error.message, correlationId);
    }
  }
}

/**
 * Delete a file with specified URI.
 * @param {string} uri - The URI of the file to be deleted.
 * @param {string} correlationId - The correlation ID for logging and tracking.
 */
function deleteFile(uri, correlationId) {
  uri = uri.replace(/[<>]/g, "");
  const filePath = uri.replace('share://', '/share/');

  try {
    fs.unlinkSync(filePath);
    console.log(`File deleted successfully: ${filePath}, Correlation ID: ${correlationId}`);
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error, `Correlation ID: ${correlationId}`);
  }
}

/**
 * Ensure that a user is logged in before proceeding with any download operation.
 * @param {string} correlationId - The correlation ID for logging and tracking.
 * @returns {Promise} A promise representing the completion of the login process.
 */
async function loginIfNeeded(correlationId) {
  if (!cookie) {
    await login(correlationId);
  }
}

/**
 * Perform a login to the SYNC_LOGIN_ENDPOINT to obtain the necessary cookie.
 * @param {string} correlationId - The correlation ID for logging and tracking.
 * @returns {Promise} A promise representing the completion of the login process.
 */
async function login(correlationId) {
  try {
    const resp = await fetch(SYNC_LOGIN_ENDPOINT, {
      headers: {
        'key': SECRET_KEY,
        'accept': "application/vnd.api+json",
        'Correlation-ID': correlationId // Add correlationId to the login request
      },
      method: 'POST'
    });

    if (!resp.ok) {
      const errorMessage = `Failed to log in. Response: ${resp.statusText}`;
      console.log(errorMessage);
      throw new Error("Could not log in");
    }

    const newCookiePart = resp.headers.get('set-cookie')?.split(/\s*;\s*/).find(part => part.startsWith('proxy_session='));

    if (newCookiePart) {
      cookie = newCookiePart;
    }
  } catch (e) {
    console.error(`Something went wrong while logging in at ${SYNC_LOGIN_ENDPOINT}:`, e.message || e);
    throw e;
  }
}

/**
 * Check if an item is a subsidy meta file.
 * @param {Object} item - The termObject item to be checked.
 * @returns {boolean} True if the item is a meta file, false otherwise.
 */
function isMetaFile(item) {
  return item.object.startsWith('<data://');
}

/**
 * Check if an item is an subsidy attachment file.
 * This also checks if the predicate is rdf:type, this to make sure
 * we process this file uri only once. 
 * @param {Object} item - The termObject item to be checked.
 * @returns {boolean} True if the item is an attachment file, false otherwise.
 */
function isAttachmentFile(item) {
  return item.subject.startsWith('<share://') && item.predicate == '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>';
}

/**
 * Create directories for the specified file path.
 * @param {string} filePath - The file path for which directories should be created.
 * @returns {Promise} A promise representing the completion of directory creation.
 */
async function createDirectories(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * Retry an operation after a specified delay.
 * @param {number} delay - The delay time in milliseconds.
 * @returns {Promise} A promise representing the completion of the retry operation.
 */
async function retryAfterDelay(delay) {
  await new Promise(resolve => setTimeout(resolve, delay));
}

module.exports = {
  DOWNLOAD_OPERATION,
  DELETE_OPERATION,
  downloadFile,
  processFileDeltas
};
