(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("contactForm");
    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var message = form.querySelector(".form-message");
      try {
        var body = DTDT.formValues(form);
        var data = await DTDT.request("/api/submissions/contact", {
          method: "POST",
          body: body,
          auth: false
        });
        DTDT.showMessage(message, data.message || "Thanks. Your message was received.", "success");
        form.reset();
        if (DTDT.resetTurnstile) DTDT.resetTurnstile(form);
      } catch (error) {
        DTDT.showMessage(message, error.message || "Unable to send message.", "danger");
        if (DTDT.resetTurnstile) DTDT.resetTurnstile(form);
      }
    });
  });
})();
