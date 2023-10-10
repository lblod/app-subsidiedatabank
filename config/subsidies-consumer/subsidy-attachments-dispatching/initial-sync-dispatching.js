const {
  BYPASS_MU_AUTH_FOR_EXPENSIVE_QUERIES,
  DIRECT_DATABASE_ENDPOINT,
  MU_CALL_SCOPE_ID_INITIAL_SYNC,
  BATCH_SIZE,
  MAX_DB_RETRY_ATTEMPTS,
  SLEEP_BETWEEN_BATCHES,
  SLEEP_TIME_AFTER_FAILED_DB_OPERATION,
  INGEST_GRAPH,
  FILE_SYNC_GRAPH,
} = require("./config");
const { batchedDbUpdate, partition } = require("./utils");
const endpoint = BYPASS_MU_AUTH_FOR_EXPENSIVE_QUERIES
  ? DIRECT_DATABASE_ENDPOINT
  : process.env.MU_SPARQL_ENDPOINT;

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
  console.log("=++=+=++=++=++++==++++===+++==++++==+=++++++=====+");
  for (const { deletes, inserts } of data.termObjects) {
    // Inserts
    const insertsFilePartition = partition(inserts, (o) =>
      o.subject.startsWith("<http://mu.semte.ch/services/file-service/files/")
    );
    const fileInserts = insertsFilePartition.passes;
    console.log("FILEINSERTS FOUND amount:", fileInserts.length);
    console.log("FILEINSERTS FOUND:", fileInserts);

    if (fileInserts.length > 0) {
      fileInserts.forEach((file) => {
        if (file.predicate === "<http://mu.semte.ch/vocabularies/core/uuid>") {
          console.log("FILE", file);
          const fileUUID = file.object.replaceAll('"', "");

          console.log("FILENAMEEE", fileUUID);
          const requestOptions = {
            method: "GET", // or 'POST', 'PUT', etc. as needed
            headers: {
              // gemeente lievegem
              Cookie:
                "proxy_session=QTEyOEdDTQ.zsB_m_pN1sBxotcVdffBPILZNrRehfuTTgekYWqVCoX01rOo2IfnZwwv0u8.zEL39VL3VE_4ugT-.ZBIfY2dPQXs_JLDnwUcYYRQAUSwF7wUlLxxVJU5jS68yn4ebQ9HGWpiQmFVGpdgFaTEDEh57_XYOUjX_CMzgC12vG2wMQBnx8aHiKE-e5ZZGFipseuyLcpZmQcQlwLlK9Z1CFM1h_moXEF6rXfBMwCiQBrOf-kcyEiLRNi6tLuhBpoJheZ66tQUndYkkGAexeo7UNNWcITBzL_5ag6KXz_-R9PX4eP1SBKdGRiobr8B_p4PjhNvXY8u8Nl12SNy-R1M9XO5yDqA8WAqRdbWmzsAZiFbrJ1CFJCxkJWZE6IAtvm4XrHP5zlJuNyeP6ZKcoa7ZcLnlbuwCRTzJthtnAL2SWv3hn34dPog_mrLbrzpN4lkRHierMGL_WYRnLgC1kIyMUQ8ct71G1ZrXVCYSPI0Qv489XN0kWijWA3Cmz6cNiuv7MIhe_ZrHWgU-lx__e6362quz4rbFgGJMF6updSxnUWAZujcQEvelv7eH9_keqiD_-nspxpTkvMGXZCEmWzo_--SbK73z5VRlx8E_N1IvCTJBrnx2MHDL4Cl56XffholG0NzgT-hRUgz2z3rKi4r280NGOsQqMP6LT9bd-inJ1_UusPh4Z3b3yFAhqV_r4rD0I672GwEVK6vMuebZVdnYdCOzYRCivkpvm0W5WJMJZbaDkNU5i5f2eXwzP8qvKH-cloFgCqiDy7FsDEWi6NVoLO1_XtxF-7Hlb98wWwvt_G8WDswQQS4UggRUDyuX9q3Hx7AOYon2BeDq3zCrHHls5i9hSkkH2odZG_hz8h-c8jGiugr7sdsbl4piOqh8jj7_2pswpiMHIqySsveJvs935zS5VLG0XCTSK607Sr-rCWyGnNt5ZRoz1ukEyTuRnnUSLbf-AZkSpwY-W9FNdrOYCPG6H8zTeilrg-aw7a-_8Tp7WltjbIkUEAjtvAZSz8beUYF1CrXwP0GQsLzQUt2xq3AYEF8_olg5QGAehrvOF3bMvEG9Kla_77cNsZ4c7Ig5EfXBzIBkSPq6j_Ssxe6gRZPceBGec0cDXmfN4Sqh9l4FpGCQk9WHEKanUvAkBE58hOESC8sTFUy8CHpKfvUm8STg5TwJlBwtp0FZM-feg81PGJZVIew3YZyDIQKJBmEy_xqVwNeG-5Nwv-Llcy478CBn_PsbU9ExxAZwPMczrXISWA2nOsQdk4wuFJfWalrKKstwaUzuLp99ZvatE2-mpjY4-CAmRigKWX4B-uQkD7xsj8Kup5nSThROk4UZMllzN4FhWhmWiaULOEzqO0W_QES1EmZcvLd4TYWTiFRSOMkxN7ZWM2Y9nma295t0-GYN_8xOu6wzFcKrnjWZ-I4tQfA2pC8CeA6-u2onPtiJ6nXzLh-PfNZgCp8rJh-RPX4A-k85Sc1eB09NHl9lv1d1YJxGttoPS1RS9wTUihFkxbksHssWs95DjuNsGueGfn405j6xLbI7jhJYxR-1HCwf85h6i4X0ucTjBjrf_DsNnE-0SQnw5gtIrROSLdRDX60SJ6GIzVB74YR5tiGRbR4MVjINQIMXMhOAhW5rHiHKUVZ1Ph1Yj8E7eNWHQ-ypdnxIXHJHgxDIwj1EtWFfOJ3KT7qPZbpl4pnHu4nzk-rawcK50nIQFZ3syIqsFiyvsOLDDvy0jwTKnB3Y7YpEq8zXbg7X6Pt82wMdGUJZeqK3Vuvtgt-Eo36txg.QXjZuXPjuwzy5b5i-0feXw",
            },
          };
          // const downloadFileURL = `http://docker.host.internal:90/${fileUUID}/download`;
          const downloadFileURL = `http://producer-identifier/files/${fileUUID}/download`;
          // const downloadFileURL = `http://producer-identifier/files/${fileUUID}/download`;
          // const downloadFileURL = `http://192.168.20.186:99/files/${fileUUID}/download`;
          console.log("START FETCHNG of", downloadFileURL);
          // const fileData = await fetch(downloadFilePath);
          fetch(downloadFileURL, requestOptions)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }
              const fileStream = fs.createWriteStream(`/mnt/${fileUUID}.txt`);
              response.body.pipe(fileStream);
              return new Promise((resolve, reject) => {
                fileStream.on("finish", resolve);
                fileStream.on("error", reject);
              });
            })
            .then(() => {
              console.log("------------->File downloaded successfully.");
            })
            .catch((error) => {
              console.error(
                "----------->>>>Error downloading the file:",
                error
              );
            });
        }
      });
    }
  }
}

module.exports = {
  dispatch,
};
