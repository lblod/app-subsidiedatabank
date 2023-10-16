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
const { batchedDbUpdate, partition } = require('./utils');

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
  const { termObjects } = data;

  if (termObjects.length) {
    // Attachments
    const insertsFilePartition = partition(termObjects, (o) =>
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
              "proxy_session=QTEyOEdDTQ.7e5BfvAaEWBWyT9IdAFC9aGS5vN1goxAWMKbKgv_e6jesm9y0iLwXgSrVgg.NnHx2O2xjoatimoh.ybldxCk2SJXU9mq6mtfJAIinB49k9WTiZjHvRo7KDuNWqJj7d1V9k_YorLr4wGRYq_-j-eO5gLrxTzBBJE9V-JhdvbTIaC3W-QYAcgPopmrfzcsqCo9jogohTipLzkhSw2AMx6Kzllhy6j0mTv1l6zUF7-3jTtvw448NZT_Ji2FizStevQ5ENH9AoeajCsF75o3tb_F4VJ_m4t7mkEcJZ02k5praox9bLDSaKMlE7QGNOnWNuiAu0ZYrwGt_bAzk9jC6CHNE3X-tTwYz_I57S36wh17PkCgoPIQ4ND5oN6IbqXGqHFlPoYhI_0zSo0C3GZ8heRlPNiMaRnURGNiDkqkrb99k2qcOVlotyAcSEnd_syV-oE9KcybTg80Z0LkbUzk7ym6Ix_kICveEV9DkNBclGVBXZTeOWoWm1UUvhJfL_shPU65heNvQboRnViAUDYNlTD5oy_OrAymrJX8iPhiTQ-yFSM3FkF9pT0EQPFpxYqiFDCpf2ut4ULuV5XwpORR4gl8_Ui2bSZFxiL0KpSXvFlgDuBQ4H9LBlh3Rm6teIXdyDzWtI-IEMZK9usJugMhXw2a8QSBnWZl5u121rzqXVSF52mfeS08GGvl8dz9YGgPls4MZKQD963wdiQ6SYCAbPbK9Mu2k7ACfwaUupt6svI9k3UU54L97cRZy5C4z6YXb8jeR3qRTg5rG380Ao8NM3R-uJ_CCAfg5ZV1AbQ0Ta4dkvEw6lyBZv2SgL4X21RfNbHd-CiJV9wFNEY8UNmuq7iSU7rumg6H6kKhNATWWeDZpGJ0kFrUhEDpMPrb1deiXq2rgI4u25ZT7oMPxp_6wTnAzuhfn9wYT_lIDjEYrgn4l57w74mqoJTh6t3qbHtJiHNqZhcpR8q85APQ-54BPZOWLlUAL8mrdrVkVFq3Ug6Dcb9dSejAT4DxzJOw93TbsU6sgWuO2-Vuz6IQ0hd0t6QKeM0x0HAeGSpIV-rIN3Gt1RRwE_ogO350IW8Z3HHTrY5JjyrplQOaK_Q0yTxBAUqccoIS3g8SvfnD5ZGCGNO9vyMNlO9_jpCWNU_zcN35coOZHnDX_AaIURV8uijvYY0ag8DGi8vz2AvJehK2dh9DmsljSzt7vjVoSQR68-IJeYRSSiOgmrsMhpdcPJ_RnQWL39wHeJfM2hxYzuWSnLLk5e2LCnj6bgSSWaB3j7DqTGrgUytG6Msfbr6cxOfA5vknt3cTjpkkbelDg6IANMyXr6C3y1Xba9KSQafxmmYu_9cALYZgakN38Km57hbb1HOOf3rUO9FD2bU_o3ktNQPlzjQZwpS1VX1SjayVZjqGW-bjng3F_FnCBke5gvmGjzXp34Ix9TnQXWr5t9lB9wvs22w5_uAYy8Rqh6KK_L4GhhDax8-bw6xg5ixoNhBx5M1QbOTdy8e4Fd8rCEiqRr5LmFXz6XGwgJuawr3WQ6kOMlsIcgnjWRjVv1SfZTZrxMP1qKqF3I6usD9zM0qJkCNQo3s4Xua0494BgXMIAbAzKZPho9svoQlrDJhVMhi_atNP6z-1RqHdyhHFVW0L45vDHsxQDbPGRMrTi0mq-urg_h_FU2yErrV19JZMQCrMKja9j9XdzyCiL4V249_2JwgHHleN1yDYGC85dllv-pndQycFhZq46LT2cK3GUlJz8l7lbU93ItmY--N42asv5N9-QtdoPGGMOMQ.ZZw3y4HSCVCmJ9cDhJ8QYQ",
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
            console.log("File downloaded successfully.");
          })
          .catch((error) => {
            console.error(
              "Error downloading the file:",
              error
              );
            });
          }
        });
      }


    // Regular Inserts
    const insertTriples = termObjects.map(o => `${o.subject} ${o.predicate} ${o.object}.`)
    await batchedDbUpdate(
      muAuthSudo.updateSudo,
      INGEST_GRAPH,
      insertTriples,
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
