const { BYPASS_MU_AUTH_FOR_EXPENSIVE_QUERIES,
  DIRECT_DATABASE_ENDPOINT,
  MU_CALL_SCOPE_ID_INITIAL_SYNC,
  BATCH_SIZE,
  MAX_DB_RETRY_ATTEMPTS,
  SLEEP_BETWEEN_BATCHES,
  SLEEP_TIME_AFTER_FAILED_DB_OPERATION,
  INGEST_GRAPH,
  FILE_SYNC_GRAPH
} = require('./config');
const { batchedDbUpdate, partition } = require('./utils');
const endpoint = BYPASS_MU_AUTH_FOR_EXPENSIVE_QUERIES ? DIRECT_DATABASE_ENDPOINT : process.env.MU_SPARQL_ENDPOINT;

/**
* Dispatch the fetched information to a target graph.
* @param { mu, muAuthSudo, fetch } lib - The provided libraries from the host service.
* @param { termObjects } data - The fetched quad information, which objects of serialized Terms
*          [ {
*              graph: "<http://foo>",
*              subject: "<http://bar>",
*              predicate: "<http://baz>",
*              object: "<http://boom>^^<http://datatype>"
*            }
*         ]
* @return {void} Nothing
*/
async function dispatch(lib, data) {
  const { mu, muAuthSudo, fetch } = lib;
  const { termObjects } = data;

  const partitions = partition(termObjects, o => o.subject.startsWith('<share://'));
  const fileInserts = partitions.passes;


  fileInserts.forEach(file => {
    // fetch the file and store it in the file-service at ./data/files

    console.log(file);
    // TODO: add loket url?
    const downloadFilePath = `/delta-files-share/download?uri=${file.subject}`;
    const fileData = fetch(downloadFilePath);

    // write the file to the file-service manually or via call https://github.com/mu-semtech/file-service#how-to-upload-a-file-using-a-curl-command
    // TODO: double check the location
    fs.writeFileSync('/share/', fileData);
  });

}

module.exports = {
  dispatch
};
