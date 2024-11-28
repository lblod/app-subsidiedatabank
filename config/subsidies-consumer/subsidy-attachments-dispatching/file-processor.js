const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Import UUID library for generating correlation IDs

const { 
  MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS, 
  SECRET_KEY, 
  SLEEP_TIME_AFTER_FAILED_FILE_DOWNLOAD_OPERATION, 
  SYNC_BASE_URL, 
  SYNC_LOGIN_ENDPOINT
} = require("./config");
const { createError } = require('./error');

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
  const correlationId = uuidv4(); // Generate a correlation ID for this batch of operations
  console.log(`Processing file deltas with correlation ID: ${correlationId}`);
  
  for (const item of termObjects) {
    // Process meta files (<data://)
    if (isMetaFile(item)) {
      if (operation === DOWNLOAD_OPERATION) {
        await downloadFile(item.object.replace('<data://', '<share://subsidies/'), fetch, correlationId);
      } else if (operation === DELETE_OPERATION) {
        deleteFile(item.object.replace('<data://', '<share://subsidies/'), correlationId);
      }
    }

    // Process attachments (<share://)
    else if (isAttachmentFile(item)) {
      if (operation === DOWNLOAD_OPERATION) {
        await downloadFile(item.subject, fetch, correlationId);
      } else if (operation === DELETE_OPERATION) {
        deleteFile(item.subject, correlationId);
      }
    }
  }
}

/**
 * Download a file with specified URI from producer.
 * @param {string} uri - The URI of the file to be downloaded.
 * @param {function} fetcher - The fetch function to use for downloading.
 * @param {string} correlationId - The correlation ID for logging and tracking.
 * @returns {Promise} A promise representing the completion of the download.
 */
async function downloadFile(uri, fetcher, correlationId) {
  try {
    await loginIfNeeded(correlationId);

    const fetchOptions = {
      headers: {
        cookie: cookie,
      },
    };

    uri = uri.replace(/[<>]/g, "");
    const fileName = uri.replace('share://', '');
    const downloadFileURL = `${SYNC_BASE_URL}/delta-files-share/download?uri=${uri}`;

    let filePath = `/share/${fileName}`;

    let attempt = 1;

    while (attempt <= MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS) {
      console.log(`Downloading file ${uri} from ${downloadFileURL}, Attempt ${attempt}, Correlation ID: ${correlationId}`);
      const response = await fetcher(downloadFileURL, fetchOptions);

      if (response.ok) {
        const buffer = await response.buffer();
        await createDirectories(filePath);

        fs.writeFileSync(filePath, buffer);
        console.log(`File downloaded successfully: ${filePath}, Correlation ID: ${correlationId}`);
        return;
      } else {
        console.error(`Failed to download file ${uri} (${response.status}), Correlation ID: ${correlationId}`);
        if (attempt === MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS) {
          const errorMessage = `Failed to download file ${uri} after ${MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS} attempts. Response: ${response.statusText}, Correlation ID: ${correlationId}`;
          createError(SYNC_BASE_URL, errorMessage, correlationId);
        }
        await retryAfterDelay(SLEEP_TIME_AFTER_FAILED_FILE_DOWNLOAD_OPERATION);
        attempt++;
      }
    }
  } catch (error) {
    console.error(`An error occurred during the download process for file ${uri}:`, error, `Correlation ID: ${correlationId}`);
    const errorMessage = `An error occurred during the download process for file ${uri}: ${error.message || error}, Correlation ID: ${correlationId}`;
    createError(SYNC_BASE_URL, errorMessage, correlationId);
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
      createError(SYNC_BASE_URL, errorMessage, correlationId);
      throw new Error("Could not log in");
    }

    const newCookiePart = resp.headers.get('set-cookie')?.split(/\s*;\s*/).find(part => part.startsWith('proxy_session='));

    if (newCookiePart) {
      cookie = newCookiePart;
    }
  } catch (e) {
    console.error(`Something went wrong while logging in at ${SYNC_LOGIN_ENDPOINT}:`, e);
    const errorMessage = `Something went wrong while logging in at ${SYNC_LOGIN_ENDPOINT}: ${e.message || e}`;
    createError(SYNC_BASE_URL, errorMessage, correlationId);
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
  processFileDeltas
};
