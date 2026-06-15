(function () {
  "use strict";

  var currentPage = 1;
  var currentQuery = "";
  var pollingTimer = null;

  document.addEventListener("DOMContentLoaded", function () {
    var params = new URLSearchParams(window.location.search);
    var query = params.get("q") || "";
    var input = document.getElementById("Search-Bar-1");
    if (input) input.value = query;
    currentQuery = query;

    bindEvents();
    if (query.trim() || params.has("q")) {
      performSearch(1, { allowBlank: true });
    } else {
      showIdle();
    }
  });

  function bindEvents() {
    var searchButton = document.getElementById("StartSearch");
    var searchInput = document.getElementById("Search-Bar-1");
    var previous = document.getElementById("prevPage");
    var next = document.getElementById("nextPage");

    if (searchButton) {
      searchButton.addEventListener("click", function () {
        performSearch(1, { allowBlank: true });
      });
    }

    if (searchInput) {
      searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          performSearch(1, { allowBlank: true });
        }
      });
    }

    if (previous) {
      previous.addEventListener("click", function () {
        if (currentPage > 1) performSearch(currentPage - 1, { allowBlank: true });
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        performSearch(currentPage + 1, { allowBlank: true });
      });
    }
  }

  function filterValue(name) {
    var selected = document.querySelector('input[name="' + name + '"]:checked');
    if (!selected || selected.value === "any") return undefined;
    return selected.value;
  }

  function buildSearchBody(page) {
    var stateSelect = document.getElementById("stateFilter");
    var industry = document.getElementById("industryFilter");
    var thcFriendly = document.getElementById("thcFriendly");
    var remotePolicy = document.getElementById("remotePolicyFilter");

    return {
      q: (document.getElementById("Search-Bar-1") || {}).value || "",
      page: page,
      pageSize: 12,
      state: stateSelect && stateSelect.value ? stateSelect.value : undefined,
      industry: industry && industry.value ? industry.value : undefined,
      preEmploymentTesting: filterValue("preEmploymentTesting"),
      randomTesting: filterValue("randomTesting"),
      postAccidentTesting: filterValue("postAccidentTesting"),
      reasonableSuspicionTesting: filterValue("reasonableSuspicionTesting"),
      thcFriendly: thcFriendly && thcFriendly.checked ? "true" : undefined,
      remotePolicy: remotePolicy && remotePolicy.value ? remotePolicy.value : undefined
    };
  }

  async function performSearch(page, options) {
    options = options || {};
    currentPage = page;
    currentQuery = (document.getElementById("Search-Bar-1") || {}).value || "";
    clearTimeout(pollingTimer);

    var body = buildSearchBody(page);
    if (!hasActiveCriteria(body) && !options.allowBlank) {
      showIdle();
      var idleUrl = new URL(window.location.href);
      idleUrl.searchParams.delete("q");
      window.history.replaceState({}, "", idleUrl);
      return;
    }

    setLoading(true);
    setQueueState("Queued", "Your search is entering the queue.");

    try {
      var data = await DTDT.request("/api/search/jobs", {
        method: "POST",
        body: body
      });
      updateJob(data.job);
      if (currentQuery.trim()) {
        var nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("q", currentQuery.trim());
        window.history.replaceState({}, "", nextUrl);
      } else if (!hasActiveCriteria(body)) {
        var randomUrl = new URL(window.location.href);
        randomUrl.searchParams.set("q", "");
        window.history.replaceState({}, "", randomUrl);
      }
      if (data.job.state === "QUEUED" || data.job.state === "PROCESSING") {
        pollJob(data.job.id);
      }
    } catch (error) {
      setLoading(false);
      showError(error.message || "Search failed. Please try again.");
    }
  }

  function hasActiveCriteria(body) {
    return Boolean(
      (body.q && body.q.trim()) ||
        body.state ||
        body.industry ||
        body.preEmploymentTesting ||
        body.randomTesting ||
        body.postAccidentTesting ||
        body.reasonableSuspicionTesting ||
        body.thcFriendly ||
        body.remotePolicy
    );
  }

  async function pollJob(jobId) {
    try {
      var data = await DTDT.request("/api/search/jobs/" + encodeURIComponent(jobId));
      updateJob(data.job);
      if (data.job.state === "QUEUED" || data.job.state === "PROCESSING") {
        pollingTimer = setTimeout(function () {
          pollJob(jobId);
        }, 900);
      }
    } catch (error) {
      setLoading(false);
      showError(error.message || "Unable to read search status.");
    }
  }

  function updateJob(job) {
    if (!job) return;

    if (job.state === "QUEUED") {
      setLoading(true);
      setQueueState("Queued", job.position ? "Position " + job.position + " in line." : "Waiting for a worker.");
      return;
    }

    if (job.state === "PROCESSING") {
      setLoading(true);
      setQueueState("Processing", "Searching the company database now.");
      return;
    }

    setLoading(false);

    if (job.state === "RATE_LIMITED") {
      var message = rateLimitMessage(job);
      setQueueState("Rate Limited", message);
      showRateLimitError(message);
      return;
    }

    if (job.state === "FAILED") {
      setQueueState("Failed", job.error || "Search failed.");
      showError(job.error || "Search failed. Please try again.");
      return;
    }

    setQueueState("Completed", job.results && job.results.random ? "Showing random reports." : "Search completed.");
    displayResults(job.results || { results: [], total: 0, page: currentPage, hasNext: false });
  }

  function displayResults(data) {
    var container = document.getElementById("resultsContainer");
    var info = document.getElementById("resultsInfo");
    var count = document.getElementById("resultsCount");
    var pageInfo = document.getElementById("pageInfo");
    var pagination = document.getElementById("pagination");
    var previous = document.getElementById("prevPage");
    var next = document.getElementById("nextPage");
    var currentPageLabel = document.getElementById("currentPage");

    if (!container) return;
    container.textContent = "";

    var results = data.results || [];
    if (info) info.style.display = "block";
    if (count) count.textContent = data.random ? String(results.length || 0) + " random" : String(data.total || results.length || 0);
    if (pageInfo) pageInfo.textContent = data.random ? "Random picks" : "Page " + (data.page || currentPage);

    if (!results.length) {
      var empty = document.createElement("div");
      empty.className = "alert alert-info";
      empty.textContent = "No reports found matching your criteria.";
      container.appendChild(empty);
    } else {
      results.forEach(function (report) {
        container.appendChild(companyCard(report));
      });
    }

    if (data.random) {
      if (pagination) pagination.style.display = "none";
      return;
    }

    if (pagination) pagination.style.display = "block";
    if (previous) previous.disabled = currentPage <= 1;
    if (next) next.disabled = !data.hasNext;
    if (currentPageLabel) currentPageLabel.textContent = String(currentPage);
  }

  function companyCard(company) {
    var item = document.createElement("article");
    item.className = "list-group-item company-result";

    var header = document.createElement("div");
    header.className = "d-flex w-100 justify-content-between gap-3";

    var title = document.createElement("a");
    title.className = "company-title";
    title.href = "company.html?slug=" + encodeURIComponent(company.slug);
    title.textContent = company.name || "Unnamed company";
    header.appendChild(title);

    var industry = document.createElement("small");
    industry.className = "text-muted";
    industry.textContent = company.industry || "Industry not listed";
    header.appendChild(industry);
    item.appendChild(header);

    var location = document.createElement("div");
    location.className = "text-muted small mt-1";
    location.textContent = "Report location: " + reportLocation(company);
    item.appendChild(location);

    var badges = document.createElement("div");
    badges.className = "mt-2 policy-badges";
    badges.appendChild(policyBadge("Pre-employment", company.preEmploymentTesting));
    badges.appendChild(policyBadge("Random", company.randomTesting));
    badges.appendChild(policyBadge("Post-accident", company.postAccidentTesting));
    item.appendChild(badges);

    var meta = document.createElement("p");
    meta.className = "company-meta";
    meta.textContent =
      "Last updated: " +
      (company.lastUpdatedAt ? new Date(company.lastUpdatedAt).toLocaleDateString() : "Unknown") +
      " | Comments: " +
      (company.commentCount || 0) +
      " | Pending suggestions: " +
      (company.pendingSuggestionCount || 0);
    item.appendChild(meta);

    return item;
  }

  function reportLocation(company) {
    return [company.headquarters, company.state].filter(Boolean).join(", ") || "Location not listed";
  }

  function policyBadge(label, value) {
    var badge = document.createElement("span");
    var normalized = String(value || "UNKNOWN").toUpperCase();
    var tone = normalized === "NO" ? "success" : normalized === "YES" ? "danger" : normalized === "SOMETIMES" ? "warning" : "secondary";
    badge.className = "badge bg-" + tone + " me-1";
    badge.textContent = label + ": " + DTDT.formatPolicy(value);
    return badge;
  }

  function setLoading(isLoading) {
    var spinner = document.getElementById("loadingSpinner");
    if (spinner) spinner.style.display = isLoading ? "block" : "none";
  }

  function setQueueState(state, detail) {
    var label = document.getElementById("queueState");
    var description = document.getElementById("queueDetail");
    if (label) label.textContent = state;
    if (description) description.textContent = detail || "";
  }

  function showIdle() {
    setLoading(false);
    setQueueState("Ready", "Enter a company name or choose filters to search.");

    var container = document.getElementById("resultsContainer");
    var info = document.getElementById("resultsInfo");
    var pagination = document.getElementById("pagination");

    if (info) info.style.display = "none";
    if (pagination) pagination.style.display = "none";
    if (!container) return;

    container.textContent = "";
    var empty = document.createElement("div");
    empty.className = "alert alert-info";
    empty.textContent = "Search for a company, location, or policy, or press Search with an empty box to see random reports.";
    container.appendChild(empty);
  }

  function showError(message) {
    var container = document.getElementById("resultsContainer");
    if (!container) return;
    container.textContent = "";
    var error = document.createElement("div");
    error.className = "alert alert-danger";
    error.textContent = message;
    container.appendChild(error);
  }

  function isSignedIn() {
    return Boolean(DTDT.getAccessToken && DTDT.getAccessToken());
  }

  function rateLimitMessage(job) {
    var fallback = isSignedIn()
      ? "You have reached your account search limit. Contact the site administrator for additional searches."
      : "You've reached the guest search limit. Create a free account to keep searching.";
    var message = job.error || fallback;
    if (!isSignedIn() && /contact the site administrator/i.test(message)) {
      return fallback;
    }
    return message;
  }

  function showRateLimitError(message) {
    var container = document.getElementById("resultsContainer");
    if (!container) return;
    container.textContent = "";

    var error = document.createElement("div");
    error.className = "alert alert-warning";
    error.textContent = message;
    container.appendChild(error);

    if (!isSignedIn()) {
      var action = document.createElement("a");
      action.className = "btn btn-primary";
      action.href = "signup.html";
      action.textContent = "Create an account";
      container.appendChild(action);
    }
  }

  window.performSearch = performSearch;
  window.applyFilters = function applyFilters() {
    performSearch(1, { allowBlank: true });
    var menu = document.getElementById("offcanvas-menu");
    if (menu && window.bootstrap) {
      bootstrap.Offcanvas.getOrCreateInstance(menu).hide();
    }
  };
  window.resetFilters = function resetFilters() {
    Array.prototype.slice.call(document.querySelectorAll("#offcanvas-menu input[type='radio'][value='any']")).forEach(function (input) {
      input.checked = true;
    });
    Array.prototype.slice.call(document.querySelectorAll("#offcanvas-menu input[type='text'], #offcanvas-menu select")).forEach(function (input) {
      input.value = "";
    });
    var thc = document.getElementById("thcFriendly");
    if (thc) thc.checked = false;
    performSearch(1, { allowBlank: true });
  };
})();
