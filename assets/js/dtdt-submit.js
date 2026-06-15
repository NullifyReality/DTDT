(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("submissionForm");
    if (!form) return;

    form.style.display = "none";
    requireLogin(form).then(function (allowed) {
      if (allowed) form.style.display = "";
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var message = form.querySelector(".form-message");
      var data = Object.fromEntries(new FormData(form).entries());
      var reportState = String(data.state || "").trim().toUpperCase();
      var payload = {
        name: data.name,
        website: data.website,
        industry: data.industry,
        headquarters: data.headquarters,
        state: reportState,
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

  async function requireLogin(form) {
    var message = form.querySelector(".form-message");
    try {
      if (!DTDT.getAccessToken()) {
        await DTDT.refreshSession();
      }
      await DTDT.request("/api/auth/me");
      return true;
    } catch (_error) {
      DTDT.clearUserSession();
      showLoginRequired(form, message);
      return false;
    }
  }

  function showLoginRequired(form, message) {
    var redirect = encodeURIComponent(window.location.pathname.split("/").pop() || "submit.html");
    if (message) message.style.display = "none";
    var alert = document.createElement("div");
    alert.className = "alert alert-warning";
    alert.textContent = "Please log in before submitting company information.";
    var link = document.createElement("a");
    link.className = "btn btn-primary w-100 mt-3";
    link.href = "login.html?redirect=" + redirect;
    link.textContent = "Log in to submit";
    form.parentNode.insertBefore(alert, form);
    form.parentNode.insertBefore(link, form.nextSibling);
  }
})();
