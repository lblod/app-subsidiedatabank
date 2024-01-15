const {
  MU_CALL_SCOPE_ID_INITIAL_SYNC,
  BATCH_SIZE,
  MAX_DB_RETRY_ATTEMPTS,
  SLEEP_BETWEEN_BATCHES,
  SLEEP_TIME_AFTER_FAILED_DB_OPERATION,
  INGEST_GRAPH,
} = require('./config');

const { processFileDeltas, DOWNLOAD_OPERATION } = require('./file-processor');
const { batchedDbUpdate} = require('./utils');

/**
 * Dispatch the fetched information to a target graph. The function consists of 3 parts:
 * - Regular inserts
 * - Meta ttl inserts
 * - Attachment inserts
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

  await processFileDeltas(termObjects, fetch, DOWNLOAD_OPERATION)
  
  // Regular Inserts
  const insertStatements = termObjects?.map(
    (o) => `${o.subject} ${o.predicate} ${o.object}.`
  );
  
  if (insertStatements?.length) {
    await batchedDbUpdate(
      muAuthSudo.updateSudo,
      INGEST_GRAPH,
      insertStatements,
      {
        'mu-call-scope-id': MU_CALL_SCOPE_ID_INITIAL_SYNC,
      },
      process.env.MU_SPARQL_ENDPOINT,
      BATCH_SIZE,
      MAX_DB_RETRY_ATTEMPTS,
      SLEEP_BETWEEN_BATCHES,
      SLEEP_TIME_AFTER_FAILED_DB_OPERATION,
      'INSERT'
    );
  }

}

module.exports = {
  dispatch,
};
