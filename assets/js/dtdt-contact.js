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
        var delivered = !data.emailDelivery || data.emailDelivery.delivered !== false;
        DTDT.showMessage(
          message,
          delivered
            ? data.message || "Thanks. Your message was received."
            : "Your message was saved, but the email notification could not be sent. We can still review it in moderation.",
          delivered ? "success" : "warning"
        );
        form.reset();
        if (DTDT.resetTurnstile) DTDT.resetTurnstile(form);
      } catch (error) {
        DTDT.showMessage(message, error.message || "Unable to send message.", "danger");
        if (DTDT.resetTurnstile) DTDT.resetTurnstile(form);
      }
    });
  });
})();
