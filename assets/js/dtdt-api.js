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
    updateAuthLinks();
  }

  function clearUserSession() {
    setAccessToken(null);
    window.localStorage.removeItem("dtdt_user");
    updateAuthLinks();
  }

  function isLoginHref(href) {
    return /^login\.html(?:[?#].*)?$/.test(String(href || ""));
  }

  function isSignedIn() {
    return Boolean(getAccessToken() || currentUser());
  }

  function updateAuthLinks() {
    var signedIn = isSignedIn();
    Array.prototype.slice.call(document.querySelectorAll("a[href]")).forEach(function (link) {
      var originalHref = link.dataset.authLoginHref || link.getAttribute("href");
      if (!isLoginHref(originalHref)) return;

      if (!link.dataset.authLoginHref) {
        link.dataset.authLoginHref = originalHref;
        link.dataset.authLoginText = link.textContent || "Login";
      }

      if (signedIn) {
        link.setAttribute("href", "#");
        link.textContent = "Logout";
        link.setAttribute("aria-label", "Logout");
        if (!link.dataset.authLogoutBound) {
          link.dataset.authLogoutBound = "true";
          link.addEventListener("click", handleLogoutClick);
        }
      } else {
        link.setAttribute("href", link.dataset.authLoginHref);
        link.textContent = link.dataset.authLoginText || "Login";
        link.removeAttribute("aria-label");
        if (link.dataset.authLogoutBound) {
          link.removeEventListener("click", handleLogoutClick);
          delete link.dataset.authLogoutBound;
        }
      }
    });
  }

  async function handleLogoutClick(event) {
    event.preventDefault();
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch (_error) {
      // Local session cleanup still matters if the server-side refresh token already expired.
    } finally {
      clearUserSession();
      window.location.href = "index.html";
    }
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateAuthLinks);
  } else {
    updateAuthLinks();
  }
})();
