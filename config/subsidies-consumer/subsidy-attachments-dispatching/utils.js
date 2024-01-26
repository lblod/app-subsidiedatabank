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


module.exports = {
  batchedDbUpdate,
  batchedUpdate,
  deleteFromAllGraphs,
};
