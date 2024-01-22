const fs = require('fs');
const path = require('path');

const { 
  MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS, 
  SECRET_KEY, 
  SLEEP_TIME_AFTER_FAILED_FILE_DOWNLOAD_OPERATION, 
  SYNC_BASE_URL, 
  SYNC_LOGIN_ENDPOINT
} = require("./config");


// Types of operations
const DOWNLOAD_OPERATION = "download"
const DELETE_OPERATION = "delete"

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
  
  for (const item of termObjects) {
    // Process meta files (<data://)
    if (isMetaFile(item)) {
      if (operation === DOWNLOAD_OPERATION) {
        downloadFile(item.object.replace('<data://', '<share://subsidies/'), fetch);
      } else if (operation === DELETE_OPERATION) {
        deleteFile(item.object.replace('<data://', '<share://subsidies/'));
      }
    }

    // Process attachments (<share://)
    else if (isAttachmentFile(item)) {
      if (operation === DOWNLOAD_OPERATION) {
        downloadFile(item.subject, fetch);
      } else if (operation === DELETE_OPERATION) {
        deleteFile(item.subject);
      }
    }
  }
}

/**
 * Download a file with specified URI from producer.
 * @param {string} uri - The URI of the file to be downloaded.
 * @param {function} fetcher - The fetch function to use for downloading.
 * @returns {Promise} A promise representing the completion of the download.
 */
async function downloadFile(uri, fetcher) {
  await loginIfNeeded();

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
    console.log(`Downloading file ${uri} from ${downloadFileURL}, Attempt ${attempt}`);
    const response = await fetcher(downloadFileURL, fetchOptions);

    if (response.ok) {
      const buffer = await response.buffer();
      await createDirectories(filePath);

      fs.writeFileSync(filePath, buffer);
      return;
    } else {
      console.error(`Failed to download file ${uri} (${response.status})`);
      await retryAfterDelay(SLEEP_TIME_AFTER_FAILED_FILE_DOWNLOAD_OPERATION);
      attempt++;
    }
  }

  console.error(`Exceeded maximum retry attempts for downloading file ${uri}`);
}

/**
 * Delete a file with specified URI.
 * @param {string} uri - The URI of the file to be deleted.
 */
function deleteFile(uri) {
  uri = uri.replace(/[<>]/g, "");
  const filePath = uri.replace('share://', '/share/');

  try {
    fs.unlinkSync(filePath);
    console.log(`File deleted successfully: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting file ${filePath}:`, error);
  }
}


/**
 * Ensure that a user is logged in before proceeding with any download operation.
 * @returns {Promise} A promise representing the completion of the login process.
 */
async function loginIfNeeded() {
  if (!cookie) {
    await login();
  }
}

/**
 * Perform a login to the SYNC_LOGIN_ENDPOINT to obtain the necessary cookie.
 * @returns {Promise} A promise representing the completion of the login process.
 */
async function login() {
  try {
    const resp = await fetch(SYNC_LOGIN_ENDPOINT, {
      headers: {
        'key': SECRET_KEY,
        'accept': "application/vnd.api+json"
      },
      method: 'POST'
    });

    if (!resp.ok) {
      console.log("FAILED TO LOG IN");
      throw "Could not log in";
    }

    const newCookiePart = resp.headers.get('set-cookie')?.split(/\s*;\s*/).find(part => part.startsWith('proxy_session='));

    if (newCookiePart) {
      cookie = newCookiePart;
    }
  } catch (e) {
    console.error(`Something went wrong while logging in at ${SYNC_LOGIN_ENDPOINT}`);
    console.error(e);
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
  await fs.mkdirSync(path.dirname(filePath), { recursive: true });
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
