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
const fs = require("fs");

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
          const fileName = fileUUID.replaceAll('share://', '');
          console.log("FILEUUID FOUND:", fileUUID);

          const requestOptions = {
            method: "GET", // or 'POST', 'PUT', etc. as needed
            headers: {
              // gemeente lievegem
              Cookie:
                "proxy_session=QTEyOEdDTQ.rINzvwAUh4TuKOC_FGPwS8uQuM_ouYmt3ZTTDRJN-pgiAeNBbrUJGnK-wxU.Rfoe-Y_L8JRJqmQc.0LSAT37ko9t3QASju8zNpHyVlArJw6zft25FMm3xyGTVPOYccubsPHVvXXiqLT8Npo61aYDFBYcFqhDVgencDZ8ABtA8inFFzcMQxGBU7PoR6gocZa5BJEDsxUuVALfrjbk2B4WapvDPnxH47-5cET-FuqkIuSMSGBAH7E85lJSx7jeTJ2qWLq-3m-VJ4_usYOTjf17-CcrovluDvk5-2CFOkOKNtPjlD2GR44Qgdy2KDJK64WkJHuMcoOwVpIaeSJIruZHQfytpG0gZ8IfZ1IUm_KngTY5XK9Dpy36HujHyr1tRaIrmjFLj3DdD4xBYHTe1_9bXN88hx2jtBYUOjcGBmGAFMr7dG4_Y9PlA-fWr0G-5ueF9o_Kwt1uBzyJWDXJ8Aake3rAe4uY6dppzPfvvR0IyVopmQk8VtHB87n5xlnjLvZ7p7TTGLHEJRo0lmo34nGKJoPV6wXIG_yXjQdX1mB6UXiJsCCy4Z5UIWZcXGPEq7NHvfFlw_EdjSYTQvhWuNahCwjP31JSOAdInOddo_SW-0N9_ueIB8KcTtbdQnDia7IMhD41FCNyP88dPT2ojGomcqYTlSki7bQs4TUCmFrjcAplyb9QnUQaaMmru2xMtJsK-0_jEio4Bsuojwu_90J5qBqepGE2UTVJY6OkxmklMlgvdrncH5rI4A5PYBPKOYxPqGWkYRNAYHTEpm7W_pcaR9XDqNXyE0Pjkn9QQLB5CIo3qS2__R7jD136HccqmRcVdj62O6cowFNROlqKdoQHhzjgNFvwTkzY2niaVXV4eohxnt80VmNOubIl7wImWorDuHL2LIw4lJWuFzd9ic7IAduO4W-sKMou0kP7B5oRHKagoD3F9wiwUZhFp_-6pI6YHHiZ65FZi-iGsloaENTCTDKh02HkneogcbLEk4cUrzYFSXUSH9uXtICgOBovyN6tdkxp1uNPp4181-L54NlZ8MiSSJ0wk7Ds7I8h6SnMOGkvbIhc2m9RgCA1zo4020lsJuzXyY0Xxr5omt_q64awGIyoSzZrXduAwgmzlHwP9MpvbwDDVyNtePHkoPhAke7yRIivaevSZ27gMd38XHd-Jnryl8P8dNL3-rZwJgZBZYUhLLuNw01tEgYAROpl03gmmZi_ox6DbkflDB9MbBbmjNTuQNrVtKV2p4DGIQd6qEQw0MxWafLXCfwhAWeJVihUkBFgpWkiGN8MNatSZRVQTUptv06YL6eYIKVY2oaIsja4OpAFKsVYcTYA7M3NXIZm0IZkicYvepgLl3BwhSAIC3CF1A1O6TGYY-Ze7e1e8JNgiqRHO7Jo028zjij0gooef-QAaB2Qo7VOmoJxbRwdNIo2xDodHFhKsJxHmBGQXTTwwLOFYQ7OOlTZGSWjW6aKTcD1951_ALNMHMAGr_kSEUMddMHKYVTEPBOWHSVN6Sb2Q5DfsH7yxkqqmdRQJFvtfdpmfUnVTNKn6dLyp3HLyI8duUbrFNG29pF1moXu-rh6mclL46yPEhaK_mehqHV_Fb-VwrM5VOG_kwo963Yp6cSthVFUpv21PvoGnZ3_epZkH_MQHhCMqDuxFsuDnGjEeUKVCxRrYvQFmsBQzupLWeP0Bxc0AmE09bYiCgFq0eSfc6TExgafIlYHnushuBIEvYFQWeTwXp08ZoMtG7PfxWwTwQLi0S-TFbytkPCwvIx3Eo6eVBA.sohFRCVEuqwp7sJU1ceifA",
            },
          };
          const downloadFileURL = `http://producer-identifier/delta-files-share/download?uri=${fileUUID}`;
          console.log("START FETCHNG of", downloadFileURL);
          // const fileData = await fetch(downloadFilePath);
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
          // fetcher(downloadFileURL, requestOptions)
          //   .then((response) => {
          //     if (!response.ok) {
          //       throw new Error(`HTTP error! Status: ${response.status}`);
          //     }

          //     const fileStream = fs.createWriteStream(`/mnt/${fileUUID}`);
          //     response.body.pipe(fileStream);

          //     return new Promise((resolve, reject) => {
          //       fileStream.on("finish", resolve);
          //       fileStream.on("error", reject);
          //     });
          //   })
          //   .then(() => {
          //     console.log("------------->File downloaded successfully.");
          //   })
          //   .catch((error) => {
          //     console.error(
          //       "----------->>>>Error downloading the file:",
          //       error
          //     );
          //   });
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
