import { uuid, sparqlEscapeString, sparqlEscapeUri, sparqlEscapeDateTime } from 'mu';
import { updateSudo as update } from '@lblod/mu-auth-sudo';

const errorType = 'http://redpencil.data.gift/id/error/subsidies-consumer'

export async function createError(graph, message, correlationId){
  const id = uuid();
  const uri = errorType + '/' + id;
  const created = new Date();

  const queryError = `
   ${service_config.prefixes}
   INSERT DATA {
    GRAPH ${sparqlEscapeUri(graph)}{
      ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(errorType)};
        mu:uuid ${id};
        dct:created ${sparqlEscapeDateTime(created)};
        oslc:message ${sparqlEscapeString(message)};
        dct:identifier ${sparqlEscapeString(correlationId)}.
    }
   }
  `;

  await update(queryError);
}