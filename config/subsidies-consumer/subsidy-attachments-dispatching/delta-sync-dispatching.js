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
const { batchedUpdate, batchedDbUpdate, partition, deleteFromAllGraphs } = require('./utils');
const fs = require('fs');
const path = require('path');

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

  // Try downloading a ttl file
      // const fileUUID = file.subject.replace(/[<>]/g, "");
      // const fileUUID = 'data://tailored-meta-files/05877120-69ba-11ee-a1a4-478b9e7f5fa1-additions-meta.ttl';
      // const fileName = 'trying.ttl';

      // const requestOptions = {
      //   method: "GET",
      //   headers: {
      //     // gemeente lievegem
      //     Cookie:
      //     "proxy_session=QTEyOEdDTQ.dyEWiWXpY_ttRAxyIWhpAbtEaFSBjXwDAx7udWR3G3s1BtggOA_czNyR-fE.7csBC7xvFCDgWi99.8HSlTr-hQrM3msd4Do7UKfk5X5ORizPD8mrJ5RzrRdXNvyNLpA0AK3V0dRygd3XAYVv_qsAMSOwZeD0TaY0NKy5CY3VR7mElr728AfiGFA9CwDfEhRCtSm6mXPqy52LZgxqQ6Yx5e0X83ex3B5HH0Lrl6Tfs0k2AerLa13B6JkUH8VKHtXynShL-VNTZpAJnIXkwP2ZWB4n0gp0nmGQzJHKWWSD1xBi-VQpTlHx7aDMo81MShX97htiO1rSsRJx_jaRWtaSMm9xIniuKzc7uxftYX9ywfCxnvnwCkrPeOf-_G3aBmNpMS5G77d84Yd0VpZ00zAWWEuftNtBBpTxxYN8TCNiET1D3nYvxwlE7iVCwEmCzMuoFVz_bkUJpwTNQN1E866AEvjMIIsbrSMuWDe-ORIvb_ZeVLODXNydBnjvX21xdVmIhcje8-jmLc84BXyR30GsNRamL82GuG1w9Ty6f5lKWNAFUeKjiP-0qEr8_H1aI934fG-8sV4yQUfEADC45r3pWM-HA5krFnOdzSdYgPnjQFfK_8GZDcnPPfF5X-Z-ugp90Xhpcqxkju5t5xzLeoloQ0fjL6GfVDckKNU9GnhpObsF7ra7mtF_5hsUhdpqzIdsfEXLoM2NOgHGsIOK-mgEGPGtViNWCHkoUxGwC2iJxd8G7I6EwFN9UUqfqvIJtPku_0J2hjyibiFBWEBsLmOPCT2gDsCj8upJi-d7kF-u-8eEkEcv6pbBJ3PkvngSZd7ppeutY304_8GF2HAPAkPzWtp6RJUEdgyng6gFzczU3r98x741WgP6gCFE_Z36NwR-rYgepr5HtshHIb44wCv7wd9VyJfdgAc8qRgzPqTFF7DMWl-6cDy3ldAKCKq9741Isc1T5okI5oeJ-Bplwd1xlRw1sm9-UzHU4cI3__nQcR6VYcSrUrgXJgXSOyvN6C2nJWctQVNE8R_Kw4Pp_FHSG743hrCVhQc2YPq6cdd-cgnp_MUXC8FVKnAp5tG1uJd9PrDDUXtsxHaC0FUJnWWg5G6vBI2MSeygThIcD6rCLe_qxVU44pQXYgHS2xmQCLlvXhAr0UXdiCyAYBcygzCP3-rhl8EQ_qbgm_S-1NvTYnsWcrx0s90WFqicKwCgw9PwnZL72jon_ffwaujkge1tGn2CrdnTZFQhNGydgaUWa9GmS-FEK7LYDrneJe-ph1YSZxLYaMYuqHmZkykH_w1UOkpWQzjKPwEwPuklVnOeSsbDIutC_N19-0M5y8ULAQRSLB5bvARiq7WZw2GUl8FBYxKwdVSb8OvJUX63WuYPvKJr8U55qrUZQTpEc818WcRHas4wZG8thxFHz36dADi-e-GTUx_tdvPJQzd4KUx9uZTMlaEvOQ3Su-L-WCaBzGM01OIRCDxBs3xeROEf9aG8RrLbGKs_1T-3UBo22grrM4QfAt20Lakz40UOY85EF-dmQ-8WcIHNBmgj2Zb0o0WthrawAJe0ir5q3tV3mkuOLmPHaXXKpI_tvmcY863oGq8JlFzvwSpwIJ6J7jOftcFvF8DAaV6C14R2LwO5RRlkmtyl2tpH5lwlj6xNJEJMPmZKEZ_hyq6ZKFt6Tcll-mgWRkw0CPJb7fvfl27OmRm4yYHdMyQsD7D_lIA2MTnZGEmh3OJWRe9lbOssx_Qz-frSjm3xLgqezQn84iUSZWca4YHs3wKJlZg.lu5H9Gc1MWffxCAG0YforA",
      //   },
      // };
      // const downloadFileURL = `http://producer-identifier/delta-files-share/download?uri=${fileUUID}`;
      // console.log("-=-=-=-=-=-=-START FETCHNG of", downloadFileURL);

      // fetch(downloadFileURL, requestOptions)
      // .then((response) => {
      //   if (!response.ok) {
      //     throw new Error(`-=-=-=HTTP error! Status: ${response.status}`);
      //   }

      //   const fileStream = fs.createWriteStream(`/share/subsidies/${fileName}`);
      //   response.body.pipe(fileStream);

      //   return new Promise((resolve, reject) => {
      //     fileStream.on("finish", resolve);
      //     fileStream.on("error", reject);
      //   });
      // })
      // .then(() => {
      //   console.log("-=-=-=-=File downloaded successfully.");
      // })
      // .catch((error) => {
      //   console.error(
      //     "-=-=-=Error downloading the file:",
      //     error
      //     );
      //   });

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
        //   const fileUUID = file.subject.replace(/[<>]/g, "");
        //   const fileName = fileUUID.replaceAll("share://", "");
        //   console.log("FILEUUID FOUND:", fileUUID);

        //   const requestOptions = {
        //     method: "GET",
        //     headers: {
        //       // gemeente lievegem
        //       Cookie:
        //       "proxy_session=QTEyOEdDTQ.dyEWiWXpY_ttRAxyIWhpAbtEaFSBjXwDAx7udWR3G3s1BtggOA_czNyR-fE.7csBC7xvFCDgWi99.8HSlTr-hQrM3msd4Do7UKfk5X5ORizPD8mrJ5RzrRdXNvyNLpA0AK3V0dRygd3XAYVv_qsAMSOwZeD0TaY0NKy5CY3VR7mElr728AfiGFA9CwDfEhRCtSm6mXPqy52LZgxqQ6Yx5e0X83ex3B5HH0Lrl6Tfs0k2AerLa13B6JkUH8VKHtXynShL-VNTZpAJnIXkwP2ZWB4n0gp0nmGQzJHKWWSD1xBi-VQpTlHx7aDMo81MShX97htiO1rSsRJx_jaRWtaSMm9xIniuKzc7uxftYX9ywfCxnvnwCkrPeOf-_G3aBmNpMS5G77d84Yd0VpZ00zAWWEuftNtBBpTxxYN8TCNiET1D3nYvxwlE7iVCwEmCzMuoFVz_bkUJpwTNQN1E866AEvjMIIsbrSMuWDe-ORIvb_ZeVLODXNydBnjvX21xdVmIhcje8-jmLc84BXyR30GsNRamL82GuG1w9Ty6f5lKWNAFUeKjiP-0qEr8_H1aI934fG-8sV4yQUfEADC45r3pWM-HA5krFnOdzSdYgPnjQFfK_8GZDcnPPfF5X-Z-ugp90Xhpcqxkju5t5xzLeoloQ0fjL6GfVDckKNU9GnhpObsF7ra7mtF_5hsUhdpqzIdsfEXLoM2NOgHGsIOK-mgEGPGtViNWCHkoUxGwC2iJxd8G7I6EwFN9UUqfqvIJtPku_0J2hjyibiFBWEBsLmOPCT2gDsCj8upJi-d7kF-u-8eEkEcv6pbBJ3PkvngSZd7ppeutY304_8GF2HAPAkPzWtp6RJUEdgyng6gFzczU3r98x741WgP6gCFE_Z36NwR-rYgepr5HtshHIb44wCv7wd9VyJfdgAc8qRgzPqTFF7DMWl-6cDy3ldAKCKq9741Isc1T5okI5oeJ-Bplwd1xlRw1sm9-UzHU4cI3__nQcR6VYcSrUrgXJgXSOyvN6C2nJWctQVNE8R_Kw4Pp_FHSG743hrCVhQc2YPq6cdd-cgnp_MUXC8FVKnAp5tG1uJd9PrDDUXtsxHaC0FUJnWWg5G6vBI2MSeygThIcD6rCLe_qxVU44pQXYgHS2xmQCLlvXhAr0UXdiCyAYBcygzCP3-rhl8EQ_qbgm_S-1NvTYnsWcrx0s90WFqicKwCgw9PwnZL72jon_ffwaujkge1tGn2CrdnTZFQhNGydgaUWa9GmS-FEK7LYDrneJe-ph1YSZxLYaMYuqHmZkykH_w1UOkpWQzjKPwEwPuklVnOeSsbDIutC_N19-0M5y8ULAQRSLB5bvARiq7WZw2GUl8FBYxKwdVSb8OvJUX63WuYPvKJr8U55qrUZQTpEc818WcRHas4wZG8thxFHz36dADi-e-GTUx_tdvPJQzd4KUx9uZTMlaEvOQ3Su-L-WCaBzGM01OIRCDxBs3xeROEf9aG8RrLbGKs_1T-3UBo22grrM4QfAt20Lakz40UOY85EF-dmQ-8WcIHNBmgj2Zb0o0WthrawAJe0ir5q3tV3mkuOLmPHaXXKpI_tvmcY863oGq8JlFzvwSpwIJ6J7jOftcFvF8DAaV6C14R2LwO5RRlkmtyl2tpH5lwlj6xNJEJMPmZKEZ_hyq6ZKFt6Tcll-mgWRkw0CPJb7fvfl27OmRm4yYHdMyQsD7D_lIA2MTnZGEmh3OJWRe9lbOssx_Qz-frSjm3xLgqezQn84iUSZWca4YHs3wKJlZg.lu5H9Gc1MWffxCAG0YforA",
        //     },
        //   };
        //   const downloadFileURL = `http://producer-identifier/delta-files-share/download?uri=${fileUUID}`;
        //   console.log("START FETCHNG of", downloadFileURL);

        //   fetch(downloadFileURL, requestOptions)
        //   .then((response) => {
        //     if (!response.ok) {
        //       throw new Error(`HTTP error! Status: ${response.status}`);
        //     }

        //     const fileStream = fs.createWriteStream(`/share/${fileName}`);
        //     response.body.pipe(fileStream);

        //     return new Promise((resolve, reject) => {
        //       fileStream.on("finish", resolve);
        //       fileStream.on("error", reject);
        //     });
        //   })
        //   .then(() => {
        //     console.log("File downloaded successfully.");
        //   })
        //   .catch((error) => {
        //     console.error(
        //       "Error downloading the file:",
        //       error
        //       );
        //     });
        //   }
        // });
      // }

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

async function downloadFile(uri, fetcher){
  uri = uri.replace(/[<>]/g, "");
  const fileName = uri.replace('data://', '').replace('share://', '');
  // TODO: use the env variable SYNC_FILESHARE_ENDPOINT
  const downloadFileURL = `http://producer-identifier/delta-files-share/download?uri=${uri}`;
  console.log("-=-=-=-=-=-=-START FETCHNG of", downloadFileURL);

  let filePath = `/share/${fileName}`;
  if (uri.startsWith('data://')){
    filePath = `/share/subsidies/${fileName}`;
  }

  console.log(`Downloading file ${uri} from ${downloadFileURL}`);
  const response = await fetcher(downloadFileURL)
  if (response.ok) {
    const buffer = await response.buffer();

    // Create (sub)directories
    await fs.mkdirSync(path.dirname(filePath), { recursive: true });

    fs.writeFileSync(filePath, buffer);
  } else {
    console.error(`Failed to download file ${uri} (${response.status})`);
  }
}

module.exports = {
  dispatch,
};
