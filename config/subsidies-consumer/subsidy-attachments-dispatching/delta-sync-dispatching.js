const {
  BYPASS_MU_AUTH_FOR_EXPENSIVE_QUERIES,
  DIRECT_DATABASE_ENDPOINT,
  MU_CALL_SCOPE_ID_INITIAL_SYNC,
  BATCH_SIZE,
  MAX_DB_RETRY_ATTEMPTS,
  SLEEP_BETWEEN_BATCHES,
  SLEEP_TIME_AFTER_FAILED_DB_OPERATION,
  INGEST_GRAPH,
} = require('./config');
const { batchedDbUpdate, partition, deleteFromAllGraphs, downloadFile } = require('./utils');

/**
 * Dispatch the fetched information to a target graph.
 * Note: <share://file/data> will be ADDED to it's own graph.
 *   We take only care of adding them, not updating triples, this is a TODO
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
  const { mu, muAuthSudo, fetch } = lib;
  const { termObjectChangeSets } = data;

  for (let { deletes, inserts } of termObjectChangeSets) {
    // meta ttl Inserts
    const insertsMetaPartition = partition(inserts, (o) =>
      o.object.startsWith("<data://")
    );
    const metaInserts = insertsMetaPartition.passes;
    if(metaInserts.length > 0){
      metaInserts.forEach((file) => {
        console.log("METAAA", file);
        downloadFile(file.object, fetch);
      });
    }

    // Attachment Inserts
    const insertsFilePartition = partition(inserts, (o) =>
      o.subject.startsWith("<share://")
    );
    const fileInserts = insertsFilePartition.passes;

    if (fileInserts.length > 0) {
      fileInserts.forEach((file) => {
        if (file.predicate === "<http://mu.semte.ch/vocabularies/core/uuid>") {
          downloadFile(file.subject, fetch);
        }
      });
    }

    // Attachment Deletes
    // TODO: support deletes

    // Regular Inserts
    const insertStatements = inserts.map(o => `${o.subject} ${o.predicate} ${o.object}.`);
    if (insertStatements.length) {
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

    // Regular Deletes
    const deleteStatements = deletes.map(o => `${o.subject} ${o.predicate} ${o.object}.`);
    if (deleteStatements.length) {
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
}



module.exports = {
  dispatch,
};
