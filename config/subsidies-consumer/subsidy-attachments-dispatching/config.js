const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 100;
const MU_CALL_SCOPE_ID_INITIAL_SYNC = process.env.MU_CALL_SCOPE_ID_INITIAL_SYNC || 'http://redpencil.data.gift/id/concept/muScope/deltas/consumer/initialSync';
const BYPASS_MU_AUTH_FOR_EXPENSIVE_QUERIES = process.env.BYPASS_MU_AUTH_FOR_EXPENSIVE_QUERIES == 'true' ? true : false;
const DIRECT_DATABASE_ENDPOINT = process.env.DIRECT_DATABASE_ENDPOINT || 'http://virtuoso:8890/sparql';
const MAX_DB_RETRY_ATTEMPTS = parseInt(process.env.MAX_DB_RETRY_ATTEMPTS || 5);
const MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS = parseInt(process.env.MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS || 30);
const INGEST_GRAPH = process.env.INGEST_GRAPH || `http://mu.semte.ch/application`;
const SYNC_LOGIN_ENDPOINT = process.env.DCR_SYNC_LOGIN_ENDPOINT;
const SECRET_KEY = process.env.DCR_SECRET_KEY;

const PREFIXES = `
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX oslc: <http://open-services.net/ns/core#>
`

if(!process.env.DCR_SYNC_BASE_URL)
  throw `Expected 'DCR_SYNC_BASE_URL' to be provided.`;
const SYNC_BASE_URL = process.env.DCR_SYNC_BASE_URL;

module.exports = {
  PREFIXES,
  BATCH_SIZE,
  MU_CALL_SCOPE_ID_INITIAL_SYNC,
  BYPASS_MU_AUTH_FOR_EXPENSIVE_QUERIES,
  DIRECT_DATABASE_ENDPOINT,
  MAX_DB_RETRY_ATTEMPTS,
  INGEST_GRAPH,
  SYNC_BASE_URL,
  SYNC_LOGIN_ENDPOINT,
  SECRET_KEY,
  MAX_FILE_DOWNLOAD_RETRY_ATTEMPTS
};
