import { uuid, sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime } from 'mu';
import { updateSudo as update, querySudo as query } from '@lblod/mu-auth-sudo';
import { MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS, PREFIXES } from './config';

const fileType = 'http://redpencil.data.gift/id/subsidies-consumer/file';
const subsidiesConsumerGraph = 'http://mu.semte.ch/graphs/subsidies-consumer';

export async function getFilesForRetry() {
  const result = await query(`
    ${PREFIXES}
    SELECT ?uri ?uuid WHERE {
      GRAPH ${sparqlEscapeUri(subsidiesConsumerGraph)} {
        ?uri a ${sparqlEscapeUri(fileType)} ;
             mu:uuid ?uuid ;
             ext:attempt ?attempt .
        FILTER(?attempt < ${MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS})
      }
    }
  `);
  return result.results.bindings.map(row => ({
    uri: row.uri.value,
    uuid: row.uuid.value
  }));
}

export async function createFileRetry(uri, message, correlationId){
  const now = new Date();

  return update(`
    ${PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(subsidiesConsumerGraph)}{
        ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(fileType)};
          mu:uuid ${sparqlEscapeString(correlationId)};
          dct:created ${sparqlEscapeDateTime(now)};
          dct:modified ${sparqlEscapeDateTime(now)};
          oslc:message ${sparqlEscapeString(message)};
          ext:attempt 1 .
      }
    }
  `);
}

export async function incrementFileRetryAttempt(uri, message){
  const now = new Date();

  return update(`
    ${PREFIXES}
    DELETE {
      GRAPH ${sparqlEscapeUri(subsidiesConsumerGraph)} {
        ${sparqlEscapeUri(uri)} ext:attempt ?currentAttempt ;
                                dct:modified ?modified ;
                                oslc:message ?oldMessage .
      }
    }
    INSERT {
      GRAPH ${sparqlEscapeUri(subsidiesConsumerGraph)} {
        ${sparqlEscapeUri(uri)} dct:modified ${sparqlEscapeDateTime(now)};
                                ext:attempt ?nextAttempt ;
                                oslc:message ${sparqlEscapeString(message)} .
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(subsidiesConsumerGraph)} {
        ${sparqlEscapeUri(uri)} ext:attempt ?currentAttempt ;
                                dct:modified ?modified ;
                                oslc:message ?oldMessage .
        BIND(?currentAttempt + 1 AS ?nextAttempt)
      }
    }
  `);
}

export async function deleteFileEntry(uri) {
  return update(`
    ${PREFIXES}
    DELETE WHERE {
      GRAPH ${sparqlEscapeUri(subsidiesConsumerGraph)} {
        ${sparqlEscapeUri(uri)} ?p ?o .
      }
    }
  `);
}