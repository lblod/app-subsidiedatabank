const {
  BATCH_SIZE,
  MAX_DB_RETRY_ATTEMPTS,
  SLEEP_BETWEEN_BATCHES,
  SLEEP_TIME_AFTER_FAILED_DB_OPERATION,
  INGEST_GRAPH,
} = require('./config');

const { processFileDeltas, DELETE_OPERATION, DOWNLOAD_OPERATION } = require('./file-processor');
const { batchedDbUpdate, deleteFromAllGraphs} = require('./utils');



/**
 * Dispatch the fetched information to a target graph. The function consists of 3 parts:
 * - Regular inserts/deletes
 * - Meta ttl inserts/deletes
 * - Attachment inserts
 * @param { mu, muAuthSudo, fetch } lib - The provided libraries from the host service.
 * @param { termObjectChangeSets: { deletes, inserts } } data - The fetched changes sets, which objects of serialized Terms
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
  for (const { deletes, inserts } of data.termObjectChangeSets) {
    await processDeletes(lib, deletes);
    await processInserts(lib, inserts);
  }
}

/**
 * PROCESS DELETES
 */
async function processDeletes(lib, deletes) {
  const { mu, muAuthSudo, fetch } = lib;

  await processFileDeltas(deletes, fetch, DELETE_OPERATION)

  const deleteStatements = deletes?.map(o => `${o.subject} ${o.predicate} ${o.object}.`);
  if (deleteStatements?.length) {
    await deleteFromAllGraphs(
      muAuthSudo.updateSudo,
      deleteStatements,
      { 'mu-call-scope-id': 'http://redpencil.data.gift/id/concept/muScope/deltas/write-for-dispatch' },
      process.env.MU_SPARQL_ENDPOINT,
      MAX_DB_RETRY_ATTEMPTS,
      SLEEP_BETWEEN_BATCHES,
      SLEEP_TIME_AFTER_FAILED_DB_OPERATION,
    );
  }
}

/**
 * PROCESS INSERTS
 */
async function processInserts(lib, inserts) {
  const { mu, muAuthSudo, fetch } = lib;

  await processFileDeltas(inserts, fetch, DOWNLOAD_OPERATION)

  const insertStatements = inserts?.map(o => `${o.subject} ${o.predicate} ${o.object}.`);
  if (insertStatements?.length) {
    await batchedDbUpdate(
      muAuthSudo.updateSudo,
      INGEST_GRAPH,
      insertStatements,
      { 'mu-call-scope-id': 'http://redpencil.data.gift/id/concept/muScope/deltas/write-for-dispatch' },
      process.env.MU_SPARQL_ENDPOINT,
      BATCH_SIZE,
      MAX_DB_RETRY_ATTEMPTS,
      SLEEP_BETWEEN_BATCHES,
      SLEEP_TIME_AFTER_FAILED_DB_OPERATION,
      "INSERT"
    );
  }
}

module.exports = {
  dispatch,
};
