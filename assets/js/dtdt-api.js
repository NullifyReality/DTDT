(function () {
  "use strict";

  var localHosts = ["localhost", "127.0.0.1", ""];
  var apiBase = resolveApiBase();
  var csrfToken = null;

  function resolveApiBase() {
    if (window.DTDT_API_BASE) return window.DTDT_API_BASE;
    if (localHosts.indexOf(window.location.hostname) >= 0) {
      var host = window.location.hostname || "127.0.0.1";
      return window.location.protocol + "//" + host + ":8000";
    }
    return "https://api.dotheydrugtest.com";
  }

  function getAccessToken() {
    return window.localStorage.getItem("dtdt_access_token");
  }

  function setAccessToken(token) {
    if (token) window.localStorage.setItem("dtdt_access_token", token);
    else window.localStorage.removeItem("dtdt_access_token");
  }

  async function getCsrfToken(forceRefresh) {
    if (csrfToken && !forceRefresh) return csrfToken;
    var response = await fetch(apiBase + "/api/csrf-token", {
      cache: "no-store",
      credentials: "include"
    });
    if (!response.ok) throw new Error("Unable to initialize secure session.");
    var data = await response.json();
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  async function parseResponse(response) {
    var data = null;
    var text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_err) {
        data = { error: text };
      }
    }
    return data;
  }

  async function request(path, options) {
    options = options || {};
    var method = (options.method || "GET").toUpperCase();
    var headers = Object.assign({}, options.headers || {});
    var body = options.body;
    var isFormData = typeof FormData !== "undefined" && body instanceof FormData;

    if (method !== "GET" && method !== "HEAD") {
      headers["X-CSRF-Token"] = await getCsrfToken(false);
    }

    var token = getAccessToken();
    if (token && options.auth !== false) {
      headers.Authorization = "Bearer " + token;
    }

    if (body && !isFormData) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }

    var send = function () {
      return fetch(apiBase + path, {
        method: method,
        headers: headers,
        body: body,
        credentials: "include"
      });
    };

    var response = await send();
    var data = await parseResponse(response);

    if (response.status === 403 && data && data.error === "Invalid CSRF token." && method !== "GET" && method !== "HEAD") {
      csrfToken = null;
      headers["X-CSRF-Token"] = await getCsrfToken(true);
      response = await send();
      data = await parseResponse(response);
    }

    if (!response.ok) {
      var error = new Error((data && data.error) || "Request failed.");
      error.status = response.status;
      error.details = data && data.details;
      throw error;
    }

    return data || {};
  }

  function formValues(form) {
    var payload = Object.fromEntries(new FormData(form).entries());
    if (payload["cf-turnstile-response"] && !payload.turnstileToken) {
      payload.turnstileToken = payload["cf-turnstile-response"];
    }
    delete payload["cf-turnstile-response"];
    return payload;
  }

  async function refreshSession() {
    var data = await request("/api/auth/refresh", { method: "POST", auth: false });
    if (data.accessToken) setAccessToken(data.accessToken);
    if (data.user) window.localStorage.setItem("dtdt_user", JSON.stringify(data.user));
    return data;
  }

  function currentUser() {
    try {
      return JSON.parse(window.localStorage.getItem("dtdt_user") || "null");
    } catch (_err) {
      return null;
    }
  }

  function setUserSession(data) {
    if (data.accessToken) setAccessToken(data.accessToken);
    if (data.user) window.localStorage.setItem("dtdt_user", JSON.stringify(data.user));
  }

  function clearUserSession() {
    setAccessToken(null);
    window.localStorage.removeItem("dtdt_user");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPolicy(value) {
    var normalized = String(value || "UNKNOWN").toUpperCase();
    if (normalized === "YES") return "Yes";
    if (normalized === "NO") return "No";
    if (normalized === "SOMETIMES") return "Sometimes";
    return "Unknown";
  }

  function showMessage(element, message, type) {
    if (!element) return;
    element.className = "alert alert-" + (type || "info");
    element.textContent = message;
    element.style.display = "block";
  }

  window.DTDT = {
    apiBase: apiBase,
    request: request,
    formValues: formValues,
    getCsrfToken: getCsrfToken,
    getAccessToken: getAccessToken,
    setAccessToken: setAccessToken,
    refreshSession: refreshSession,
    currentUser: currentUser,
    setUserSession: setUserSession,
    clearUserSession: clearUserSession,
    escapeHtml: escapeHtml,
    formatPolicy: formatPolicy,
    showMessage: showMessage
  };
})();
