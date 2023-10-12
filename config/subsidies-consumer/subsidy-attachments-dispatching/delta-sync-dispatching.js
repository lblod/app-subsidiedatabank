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
} = require('./config');
const { batchedDbUpdate, partition } = require('./utils');
const fs = require('fs');

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

  for (const { deletes, inserts } of data.termObjectChangeSets) {
    // Inserts
    const insertsFilePartition = partition(inserts, (o) =>
      o.subject.startsWith("<share://")
    );
    const fileInserts = insertsFilePartition.passes;

    if (fileInserts.length > 0) {
      fileInserts.forEach((file) => {
        if (file.predicate === "<http://mu.semte.ch/vocabularies/core/uuid>") {
          const fileUUID = file.subject.replace(/[<>]/g, "");
          const fileName = fileUUID.replaceAll("share://", "");
          console.log("FILEUUID FOUND:", fileUUID);

          const requestOptions = {
            method: "GET",
            headers: {
              // gemeente lievegem
              Cookie:
                "proxy_session=QTEyOEdDTQ.jW43o1elY86shKUDIGGTXhivMGGN0qOEErIqo63hoT2DwYvZZbyD783UKRI.71BZEC6_SJ9bQgxw.YMVFR9WD6DHHpDbGE0EHWrHuKE2MxMWIrO5T63ZuFFamo8O6Un1ZLnEfs8QgMhNs00_ELHFG3l3F0eKKBBct2UFT-neqJO-CzAP2kYh9SxEOBnmc3wz1vhv7L9E2tJ2mq4bO7ZItxJN6dZYakE4G8dW12KiBWfwAMYMj_BvHsLWLQHc6wzfG8PUe_6LXw5ONamjSWASy7SFLRjiYk7EDof3C2bgdiMsHJl72VvVvtNNkMzVhi-QrVOzTtT7X_XM-xZkIGZubC6U53r4lU10b5_m5TLASrK_MdtnLMCRfDRmk1Yu_Lo0YQJRbH8stIKBH-pFwj3nU9f54UyHbpDbE6P7biaks6sgohe5uS_XKowrUTI8B-H12lhGug7lUt6ZoV8WwkTm-d7r-j5Uuoeatlomou9ckDGYTZvIi3YVQpaTX-nBENYJKFhGGoRZyyuP16VL84daJzEGAZn6BeFPtUkM1rTB0B7wBb2xO7UW8NckrTD0NnnwXq_UUzJMPz49aP1T5KbKgyUgr08KrAkD4ibeKU48NOnshO01lvufD2zViB8U8tjXPiHoDFL3KNzowjrHw1N_zTj5vlB5EZoD-66HKs5sMRcwirqT2iT-FxWtJ9_-botsKJMpfuioc4t7hurCbMYqs7OUDMWjGKFR0BsWm7dKhfkbF42zCKTpPsgKA5CrDD4aKWcD7eJzsSJb7MkB7GBgex5qFhfUYiz89VjeHEzW-gGaxBqlxaFbW5ZVq3eISbw01otGB2AHVtNUg1P9Mqh7Lm_WwcI1_wAURbvfdwVXgosS60oqpN6VOpDwTZVFkFb_0j2OifvULrxdkK9tCZ97SVhXd0PmulgLPsZzq-kv_Yg7qkw5DyoMbEnNpmCDoVoIPtaUvu7ThdFsT9r6_wqwuY22dHmyaX6htQ3aqK-jyT2FldOhvFdAs_YIos2PNEK629CR9fF-UGDpdwvJ2SNMJk01lv8o2Di-4hm2MKkWv49oI37GgHBD3pPgSLH_P6tyRYxTZGA6cvvv3Eo3_yaySEULlDnJ6YmwW2ex63JlplsCpMv4X5lrNQ-Rr-ULk0hvm9D7gNKXSe3GtHBxEB3kJMns8a2UoGRXrJh988lmQtkOazWyDpjw2m3ZcSbLv2Q2kxD4fpRG5Np97sOf7--a33bS8aPImKxXay-l0ZHe2Z20oxqxH1WfLVEtoXHcXkZJ5e5EB3ZK_2gcEj9aRe-oeD5Brz5sIPTFgIytiXV_UNhcDjU8v4nuQeDEKww2qZQJRUCeRSE5pY-Q8QbgtQFhTw2htyuKKyX5Q41OebgoFRk-BlxP3yVpa-yKG0dMyyfxgywLleIdOckOSnXG4QBDTL4MAWoacHMavo5BbtrBdyyj8v6-RaaYbMwMt_NKS6MGjbtdNJvpdVOHbRfXlVqS7azihv9W-VfZXydHEkmE6cbq0wV4PeeAmmcpa5wa-rjhVtwtDIm2YKfrYDwa51zi9TN9dQx0M1aDfQsSHm1RhvCAZczHoqfdNkDRyyBRLGoIld5YEAifoHYwzeCnLwz_Ad3xgrD-pANGlEo1-RB1qj6ebkRVA-NeOc9r1brSecjOAerYo4ikxU50KHlyycJu4eZFHJDwU-M_76bbvwJjgqaVK4TZEFkxmg6nN6fvEn0fCopIraGcPdqDwDvZAT6bbAX4MzH9FAEyW8cbtnzEgHE_iqDrttA.4DUOvRfzk7VIQdXlDl4peQ",
            },
          };
          const downloadFileURL = `http://producer-identifier/delta-files-share/download?uri=${fileUUID}`;
          console.log("START FETCHNG of", downloadFileURL);

          fetch(downloadFileURL, requestOptions)
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
              }

              const fileStream = fs.createWriteStream(`/share/${fileName}`);
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

    // if (fileInserts.length > 0) {
    //   fileInserts.forEach((file) => {
    //     console.log("FILE123,",file);
    //     if (file.predicate === "<http://mu.semte.ch/vocabularies/core/uuid>") {
    //       console.log("FILE", file);
    //       const fileUUID = file.object.replaceAll('"', "");

    //       const requestOptions = {
    //         method: 'GET', // or 'POST', 'PUT', etc. as needed
    //         headers: { // gemeente lievegem
    //           'Cookie': 'proxy_session=QTEyOEdDTQ.zsB_m_pN1sBxotcVdffBPILZNrRehfuTTgekYWqVCoX01rOo2IfnZwwv0u8.zEL39VL3VE_4ugT-.ZBIfY2dPQXs_JLDnwUcYYRQAUSwF7wUlLxxVJU5jS68yn4ebQ9HGWpiQmFVGpdgFaTEDEh57_XYOUjX_CMzgC12vG2wMQBnx8aHiKE-e5ZZGFipseuyLcpZmQcQlwLlK9Z1CFM1h_moXEF6rXfBMwCiQBrOf-kcyEiLRNi6tLuhBpoJheZ66tQUndYkkGAexeo7UNNWcITBzL_5ag6KXz_-R9PX4eP1SBKdGRiobr8B_p4PjhNvXY8u8Nl12SNy-R1M9XO5yDqA8WAqRdbWmzsAZiFbrJ1CFJCxkJWZE6IAtvm4XrHP5zlJuNyeP6ZKcoa7ZcLnlbuwCRTzJthtnAL2SWv3hn34dPog_mrLbrzpN4lkRHierMGL_WYRnLgC1kIyMUQ8ct71G1ZrXVCYSPI0Qv489XN0kWijWA3Cmz6cNiuv7MIhe_ZrHWgU-lx__e6362quz4rbFgGJMF6updSxnUWAZujcQEvelv7eH9_keqiD_-nspxpTkvMGXZCEmWzo_--SbK73z5VRlx8E_N1IvCTJBrnx2MHDL4Cl56XffholG0NzgT-hRUgz2z3rKi4r280NGOsQqMP6LT9bd-inJ1_UusPh4Z3b3yFAhqV_r4rD0I672GwEVK6vMuebZVdnYdCOzYRCivkpvm0W5WJMJZbaDkNU5i5f2eXwzP8qvKH-cloFgCqiDy7FsDEWi6NVoLO1_XtxF-7Hlb98wWwvt_G8WDswQQS4UggRUDyuX9q3Hx7AOYon2BeDq3zCrHHls5i9hSkkH2odZG_hz8h-c8jGiugr7sdsbl4piOqh8jj7_2pswpiMHIqySsveJvs935zS5VLG0XCTSK607Sr-rCWyGnNt5ZRoz1ukEyTuRnnUSLbf-AZkSpwY-W9FNdrOYCPG6H8zTeilrg-aw7a-_8Tp7WltjbIkUEAjtvAZSz8beUYF1CrXwP0GQsLzQUt2xq3AYEF8_olg5QGAehrvOF3bMvEG9Kla_77cNsZ4c7Ig5EfXBzIBkSPq6j_Ssxe6gRZPceBGec0cDXmfN4Sqh9l4FpGCQk9WHEKanUvAkBE58hOESC8sTFUy8CHpKfvUm8STg5TwJlBwtp0FZM-feg81PGJZVIew3YZyDIQKJBmEy_xqVwNeG-5Nwv-Llcy478CBn_PsbU9ExxAZwPMczrXISWA2nOsQdk4wuFJfWalrKKstwaUzuLp99ZvatE2-mpjY4-CAmRigKWX4B-uQkD7xsj8Kup5nSThROk4UZMllzN4FhWhmWiaULOEzqO0W_QES1EmZcvLd4TYWTiFRSOMkxN7ZWM2Y9nma295t0-GYN_8xOu6wzFcKrnjWZ-I4tQfA2pC8CeA6-u2onPtiJ6nXzLh-PfNZgCp8rJh-RPX4A-k85Sc1eB09NHl9lv1d1YJxGttoPS1RS9wTUihFkxbksHssWs95DjuNsGueGfn405j6xLbI7jhJYxR-1HCwf85h6i4X0ucTjBjrf_DsNnE-0SQnw5gtIrROSLdRDX60SJ6GIzVB74YR5tiGRbR4MVjINQIMXMhOAhW5rHiHKUVZ1Ph1Yj8E7eNWHQ-ypdnxIXHJHgxDIwj1EtWFfOJ3KT7qPZbpl4pnHu4nzk-rawcK50nIQFZ3syIqsFiyvsOLDDvy0jwTKnB3Y7YpEq8zXbg7X6Pt82wMdGUJZeqK3Vuvtgt-Eo36txg.QXjZuXPjuwzy5b5i-0feXw',
    //         },
    //       };
    //       // const downloadFileURL = `http://docker.host.internal:90/${fileUUID}/download`;
    //       const downloadFileURL = `http://producer-identifier/files/${fileUUID}/download`;
    //       // const downloadFileURL = `http://producer-identifier/files/${fileUUID}/download`;
    //       // const downloadFileURL = `http://192.168.20.186:99/files/${fileUUID}/download`;
    //       console.log("START FETCHNG of", downloadFileURL);
    //       // const fileData = await fetch(downloadFilePath);
    //       fetch(downloadFileURL, requestOptions)
    //         .then((response) => {
    //           if (!response.ok) {
    //             throw new Error(`HTTP error! Status: ${response.status}`);
    //           }

    //           // Extract the filename from the Content-Disposition header
    //           const contentDisposition = response.headers.get('content-disposition');
    //           const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
    //           let filename = matches && matches[1] ? matches[1].replace(/["']/g, '') : 'downloaded_file';
    //           console.log("FOUND FILENAME2 ;;;", filename);

    //           const fileStream = fs.createWriteStream(`/mnt/${filename}`);
    //           response.body.pipe(fileStream);

    //           return new Promise((resolve, reject) => {
    //             fileStream.on("finish", resolve);
    //             fileStream.on("error", reject);
    //           });
    //         })
    //         .then(() => {
    //           console.log("------------->File downloaded successfully.");
    //         })
    //         .catch((error) => {
    //           console.error("----------->>>>Error downloading the file:", error);
    //         });
    //     }
    //   });
    // }
    // Deletes
  }

  // const deletesFilePartition = partition(deletes, o => o.subject.startsWith('<share://'));
  // const fileDeletes = deletesFilePartition.passes;
  // fileDeletes.forEach(file => {
  //   // remove the file
  // });

  // const insertsFilePartition = partition(inserts, o => o.subject.startsWith('<share://'));
  // const fileInserts = insertsFilePartition.passes;
  // fileInserts.forEach(file => {
  //   // fetch the file
  //   fetch
  // });
}

module.exports = {
  dispatch,
};
