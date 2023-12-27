const fs = require('fs');
const path = require('path');
const {
  SYNC_BASE_URL,
  SYNC_LOGIN_ENDPOINT,
  SECRET_KEY,
  MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS,
  SLEEP_TIME_AFTER_FAILED_FILE_DOWNLOAD_OPERATION,
} = require('./config');

async function batchedDbUpdate(muUpdate,
  graph,
  triples,
  extraHeaders,
  endpoint,
  batchSize,
  maxAttempts,
  sleepBetweenBatches = 1000,
  sleepTimeOnFail = 1000,
  operation = 'INSERT'
) {

  for (let i = 0; i < triples.length; i += batchSize) {
    console.log(`Inserting triples in batch: ${i}-${i + batchSize}`);

    const batch = triples.slice(i, i + batchSize).join('\n');

    const insertCall = async () => {
      await muUpdate(`
${operation} DATA {
GRAPH <${graph}> {
${batch}
}
}
`, extraHeaders, endpoint);
    };

    await dbOperationWithRetry(insertCall, 0, maxAttempts, sleepTimeOnFail);

    console.log(`Sleeping before next query execution: ${sleepBetweenBatches}`);
    await new Promise(r => setTimeout(r, sleepBetweenBatches));
  }
}

async function dbOperationWithRetry(callback,
  attempt,
  maxAttempts,
  sleepTimeOnFail) {
  try {
    return await callback();
  }
  catch (e) {
    console.log(`Operation failed for ${callback.toString()}, attempt: ${attempt} of ${maxAttempts}`);
    console.log(`Error: ${e}`);
    console.log(`Sleeping ${sleepTimeOnFail} ms`);

    if (attempt >= maxAttempts) {
      console.log(`Max attempts reached for ${callback.toString()}, giving up`);
      throw e;
    }

    await new Promise(r => setTimeout(r, sleepTimeOnFail));
    return dbOperationWithRetry(callback, ++attempt, maxAttempts, sleepTimeOnFail);
  }
}


async function batchedUpdate(
  lib,
  nTriples,
  targetGraph,
  sleep,
  batch,
  extraHeaders,
  endpoint,
  operation) {
  const { muAuthSudo, chunk, sparqlEscapeUri } = lib;
  console.log("size of store: ", nTriples?.length);
  const chunkedArray = chunk(nTriples, batch);
  let chunkCounter = 0;
  for (const chunkedTriple of chunkedArray) {
    console.log(`Processing chunk number ${chunkCounter} of ${chunkedArray.length} chunks.`);
    console.log(`using endpoint from utils ${endpoint}`);
    try {
      const updateQuery = `
        ${operation} DATA {
           GRAPH ${sparqlEscapeUri(targetGraph)} {
             ${chunkedTriple.join('')}
           }
        }
      `;
      console.log(`Hitting database ${endpoint} with batched query \n ${updateQuery}`);
      const connectOptions = { sparqlEndpoint: endpoint, mayRetry: true };
      console.log('connectOptions: ', connectOptions, "Extra headers: ", extraHeaders);
      await muAuthSudo.updateSudo(updateQuery, extraHeaders, connectOptions);
      console.log(`Sleeping before next query execution: ${sleep}`);
      await new Promise(r => setTimeout(r, sleep));

    }
    catch (err) {
      // Binary backoff recovery.
      console.log("ERROR: ", err);
      console.log(`Inserting the chunk failed for chunk size ${batch} and ${nTriples.length} triples`);
      const smallerBatch = Math.floor(batch / 2);
      if (smallerBatch === 0) {
        console.log("the triples that fails: ", nTriples);
        throw new Error(`Backoff mechanism stops in batched update,
          we can't work with chunks the size of ${smallerBatch}`);
      }
      console.log(`Let's try to ingest wiht chunk size of ${smallerBatch}`);
      await batchedUpdate(lib, chunkedTriple, targetGraph, sleep, smallerBatch, extraHeaders, endpoint, operation);
    }
    ++chunkCounter;
  }
}

/**
* Splits an array into two parts, a part that passes and a part that fails a predicate function.
* Credits: https://github.com/benjay10
* @public
* @function partition
* @param {Array} arr - Array to be partitioned
* @param {Function} fn - Function that accepts single argument: an element of the array, and should return a truthy or falsy value.
* @returns {Object} Object that contains keys passes and fails, each representing an array with elemets that pass or fail the predicate respectively
*/
function partition(arr, fn) {
  let passes = [], fails = [];
  arr.forEach((item) => (fn(item) ? passes : fails).push(item));
  return { passes, fails };
}

async function deleteFromAllGraphs(muUpdate,
  triples,
  extraHeaders,
  endpoint,
  maxAttempts,
  sleepBetweenBatches = 1000,
  sleepTimeOnFail = 1000,
) {

  for (const triple of triples) {

    console.log(`Deleting a triple from all graphs in triplestore`);

    const deleteCall = async () => {
      await muUpdate(`
      DELETE {
        GRAPH ?g {
          ${triple}
        }
      } WHERE {
        GRAPH ?g {
          ${triple}
        }
      }
      `, extraHeaders, endpoint);
    };

    await dbOperationWithRetry(deleteCall, 0, maxAttempts, sleepTimeOnFail);
    console.log(`Sleeping before next query execution: ${sleepBetweenBatches}`);
    await new Promise(r => setTimeout(r, sleepBetweenBatches));
  }
}

let cookie = null;
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

    if (resp.headers.get('set-cookie')) {
      const cookieParts = resp.headers.get('set-cookie').split(/\s*;\s*/);
      const newCookiePart = cookieParts.find(part => part.startsWith('proxy_session='));

      if (newCookiePart) {
        cookie = newCookiePart;
      }
    }
  } catch (e) {
    console.log(`Something went wrong while logging in at ${SYNC_LOGIN_ENDPOINT}`);
    console.log(e);
    throw e;
  }
}

/**
 * Function to download either files that start with share:// or data://.
 * It uses the SYNC_BASE_URL to access the file-share-sync-service and download the files.
 * It will create (sub)directories if needed and store it in the right directory using the uri.
 * @param {any} uri - the uri of the file that needs to be downloaded
 * @param {any} fetcher - the fetcher function
 * @returns {any}
 */
MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS,
SLEEP_TIME_AFTER_FAILED_FILE_DOWNLOAD_OPERATION
async function downloadFileWithRetry(uri, fetcher) {
  // Login to endpoint as super user, so we can set the correct proxy_session cookie
  if(!cookie) {
    await login();
  }
  // Use the cookie from login in fetch options
  const fetchOptions = {
    headers: {
      cookie: cookie,
    },
  };

  uri = uri.replace(/[<>]/g, "");
  const fileName = uri.replace('data://', '').replace('share://', '');
  const downloadFileURL = `${SYNC_BASE_URL}/delta-files-share/download?uri=${uri}`;

  let filePath = `/share/${fileName}`;
  if (uri.startsWith('data://')){
    filePath = `/share/subsidies/${fileName}`;
  }

  let attempt = 1;

  while (attempt <= MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS) {
    console.log(`Downloading file ${uri} from ${downloadFileURL}, Attempt ${attempt}`);
    const response = await fetcher(downloadFileURL, fetchOptions);

    if (response.ok) {
      const buffer = await response.buffer();

      // Create (sub)directories
      await fs.mkdirSync(path.dirname(filePath), { recursive: true });

      fs.writeFileSync(filePath, buffer);
      return; // Successfully downloaded, exit the loop
    } else {
      console.error(`Failed to download file ${uri} (${response.status})`);

      // Retry after a delay
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME_AFTER_FAILED_FILE_DOWNLOAD_OPERATION));
      attempt++;
    }
  }

  console.error(`Exceeded maximum retry attempts for downloading file ${uri}`);
}

module.exports = {
  batchedDbUpdate,
  batchedUpdate,
  partition,
  deleteFromAllGraphs,
  downloadFileWithRetry
};
