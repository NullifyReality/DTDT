(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    bindForm("loginForm", handleLogin);
    bindForm("signupForm", handleSignup);
    bindForm("verifyForm", handleVerify);
    bindForm("forgotForm", handleForgot);
    bindForm("resetForm", handleReset);
    bindLogout();
    bindResendVerification();
  });

  function bindForm(id, handler) {
    var form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      handler(form);
    });
  }

  function values(form) {
    return DTDT.formValues(form);
  }

  function message(form, text, type) {
    var target = form.querySelector(".form-message");
    DTDT.showMessage(target, text, type || "info");
  }

  async function handleLogin(form) {
    try {
      var data = await DTDT.request("/api/auth/login", {
        method: "POST",
        body: values(form),
        auth: false
      });
      DTDT.setUserSession(data);
      message(form, "Logged in. Redirecting...", "success");
      window.setTimeout(function () {
        window.location.href = safeRedirect("search.html");
      }, 500);
    } catch (error) {
      message(form, error.message, "danger");
    }
  }

  async function handleSignup(form) {
    try {
      var data = await DTDT.request("/api/auth/signup", {
        method: "POST",
        body: values(form),
        auth: false
      });
      message(form, data.devCode ? "Account created. Verification code: " + data.devCode : data.message || "Account created. Check your email for a verification code.", data.emailDelivery && data.emailDelivery.delivered === false ? "warning" : "success");
      var verifyEmail = document.querySelector("#verifyForm input[name='email']");
      var signupEmail = form.querySelector("input[name='email']");
      if (verifyEmail && signupEmail) verifyEmail.value = signupEmail.value;
      if (DTDT.resetTurnstile) DTDT.resetTurnstile(form);
    } catch (error) {
      message(form, error.message, "danger");
      if (DTDT.resetTurnstile) DTDT.resetTurnstile(form);
    }
  }

  async function handleVerify(form) {
    try {
      var data = await DTDT.request("/api/auth/verify-email", {
        method: "POST",
        body: values(form),
        auth: false
      });
      DTDT.setUserSession(data);
      message(form, "Email verified. Redirecting...", "success");
      window.setTimeout(function () {
        window.location.href = "search.html";
      }, 500);
    } catch (error) {
      message(form, error.message, "danger");
    }
  }

  async function handleForgot(form) {
    try {
      var data = await DTDT.request("/api/auth/password/forgot", {
        method: "POST",
        body: values(form),
        auth: false
      });
      message(
        form,
        data.devCode
          ? "Reset code: " + data.devCode + " | Reset token: " + data.devResetToken
          : "If the account exists, a reset code was sent.",
        "success"
      );
      var resetEmail = document.querySelector("#resetForm input[name='email']");
      var forgotEmail = form.querySelector("input[name='email']");
      if (resetEmail && forgotEmail) resetEmail.value = forgotEmail.value;
    } catch (error) {
      message(form, error.message, "danger");
    }
  }

  async function handleReset(form) {
    try {
      await DTDT.request("/api/auth/password/reset", {
        method: "POST",
        body: values(form),
        auth: false
      });
      message(form, "Password reset. You can log in now.", "success");
    } catch (error) {
      message(form, error.message, "danger");
    }
  }

  function bindLogout() {
    var logout = document.querySelector("[data-logout]");
    if (!logout) return;
    logout.addEventListener("click", async function (event) {
      event.preventDefault();
      try {
        await DTDT.request("/api/auth/logout", { method: "POST" });
      } finally {
        DTDT.clearUserSession();
        window.location.href = "index.html";
      }
    });
  }

  function bindResendVerification() {
    var resend = document.getElementById("resendVerification");
    var form = document.getElementById("verifyForm");
    if (!resend || !form) return;
    resend.addEventListener("click", async function () {
      var emailInput = form.querySelector("input[name='email']");
      if (!emailInput || !emailInput.value) {
        message(form, "Enter your email first.", "warning");
        return;
      }

      try {
        var data = await DTDT.request("/api/auth/verification/resend", {
          method: "POST",
          body: { email: emailInput.value },
          auth: false
        });
        message(form, data.devCode ? "Verification code: " + data.devCode : data.message || "If verification is needed, a new code was sent.", data.emailDelivery && data.emailDelivery.delivered === false ? "warning" : "success");
      } catch (error) {
        message(form, error.message || "Unable to resend verification code.", "danger");
      }
    });
  }

  function safeRedirect(fallback) {
    var params = new URLSearchParams(window.location.search);
    var redirect = params.get("redirect");
    if (!redirect) return fallback;
    if (/^https?:\/\//i.test(redirect) || redirect.indexOf("//") === 0) return fallback;
    if (!/^[A-Za-z0-9._~/?#=&%-]+$/.test(redirect)) return fallback;
    return redirect;
  }

  function prefillResetFromQuery() {
    var form = document.getElementById("resetForm");
    if (!form) return;
    var params = new URLSearchParams(window.location.search);
    ["email", "code", "resetToken"].forEach(function (key) {
      var value = params.get(key);
      var input = form.querySelector("[name='" + key + "']");
      if (value && input) input.value = value;
    });
  }

  document.addEventListener("DOMContentLoaded", prefillResetFromQuery);
})();
