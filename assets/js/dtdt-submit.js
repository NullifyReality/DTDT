(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("submissionForm");
    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var message = form.querySelector(".form-message");
      var data = Object.fromEntries(new FormData(form).entries());
      var payload = {
        name: data.name,
        website: data.website,
        industry: data.industry,
        headquarters: data.headquarters,
        state: data.state,
        preEmploymentTesting: data.preEmploymentTesting,
        randomTesting: data.randomTesting,
        postAccidentTesting: data.postAccidentTesting,
        reasonableSuspicionTesting: data.reasonableSuspicionTesting,
        thcPolicy: data.thcPolicy,
        remoteWorkerPolicy: data.remoteWorkerPolicy,
        additionalNotes: data.additionalNotes,
        experience: data.experience
      };

      try {
        await DTDT.request("/api/submissions", {
          method: "POST",
          body: {
            type: data.type,
            companyId: data.companyId || undefined,
            payload: payload,
            note: data.note
          }
        });
        DTDT.showMessage(message, "Thanks. Your submission is waiting for moderator review.", "success");
        form.reset();
      } catch (error) {
        DTDT.showMessage(message, error.message || "Unable to submit.", "danger");
      }
    });
  });
})();
