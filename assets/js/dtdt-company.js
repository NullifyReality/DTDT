(function () {
  "use strict";

  var currentCompany = null;
  var currentStateResponses = [];
  var stateReportPageByState = {};
  var stateReportCommentRequest = 0;

  var STATE_MAP = [
    { code: "AK", name: "Alaska", row: 1, col: 1 },
    { code: "ME", name: "Maine", row: 1, col: 11 },
    { code: "WA", name: "Washington", row: 2, col: 2 },
    { code: "ID", name: "Idaho", row: 2, col: 3 },
    { code: "MT", name: "Montana", row: 2, col: 4 },
    { code: "ND", name: "North Dakota", row: 2, col: 5 },
    { code: "MN", name: "Minnesota", row: 2, col: 6 },
    { code: "WI", name: "Wisconsin", row: 2, col: 7 },
    { code: "MI", name: "Michigan", row: 2, col: 8 },
    { code: "NY", name: "New York", row: 2, col: 9 },
    { code: "VT", name: "Vermont", row: 2, col: 10 },
    { code: "NH", name: "New Hampshire", row: 2, col: 11 },
    { code: "OR", name: "Oregon", row: 3, col: 2 },
    { code: "NV", name: "Nevada", row: 3, col: 3 },
    { code: "WY", name: "Wyoming", row: 3, col: 4 },
    { code: "SD", name: "South Dakota", row: 3, col: 5 },
    { code: "IA", name: "Iowa", row: 3, col: 6 },
    { code: "IL", name: "Illinois", row: 3, col: 7 },
    { code: "IN", name: "Indiana", row: 3, col: 8 },
    { code: "OH", name: "Ohio", row: 3, col: 9 },
    { code: "PA", name: "Pennsylvania", row: 3, col: 10 },
    { code: "MA", name: "Massachusetts", row: 3, col: 11 },
    { code: "CA", name: "California", row: 4, col: 2 },
    { code: "UT", name: "Utah", row: 4, col: 3 },
    { code: "CO", name: "Colorado", row: 4, col: 4 },
    { code: "NE", name: "Nebraska", row: 4, col: 5 },
    { code: "MO", name: "Missouri", row: 4, col: 6 },
    { code: "KY", name: "Kentucky", row: 4, col: 7 },
    { code: "WV", name: "West Virginia", row: 4, col: 8 },
    { code: "VA", name: "Virginia", row: 4, col: 9 },
    { code: "MD", name: "Maryland", row: 4, col: 10 },
    { code: "RI", name: "Rhode Island", row: 4, col: 11 },
    { code: "HI", name: "Hawaii", row: 5, col: 1 },
    { code: "AZ", name: "Arizona", row: 5, col: 3 },
    { code: "NM", name: "New Mexico", row: 5, col: 4 },
    { code: "KS", name: "Kansas", row: 5, col: 5 },
    { code: "AR", name: "Arkansas", row: 5, col: 6 },
    { code: "TN", name: "Tennessee", row: 5, col: 7 },
    { code: "NC", name: "North Carolina", row: 5, col: 8 },
    { code: "SC", name: "South Carolina", row: 5, col: 9 },
    { code: "DE", name: "Delaware", row: 5, col: 10 },
    { code: "CT", name: "Connecticut", row: 5, col: 11 },
    { code: "OK", name: "Oklahoma", row: 6, col: 5 },
    { code: "LA", name: "Louisiana", row: 6, col: 6 },
    { code: "MS", name: "Mississippi", row: 6, col: 7 },
    { code: "AL", name: "Alabama", row: 6, col: 8 },
    { code: "GA", name: "Georgia", row: 6, col: 9 },
    { code: "NJ", name: "New Jersey", row: 6, col: 10 },
    { code: "TX", name: "Texas", row: 7, col: 5 },
    { code: "FL", name: "Florida", row: 7, col: 10 },
    { code: "DC", name: "District of Columbia", row: 7, col: 11 }
  ];

  document.addEventListener("DOMContentLoaded", function () {
    loadCompany();
    bindForms();
  });

  async function loadCompany() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get("slug");
    if (!slug) {
      renderError("Missing company slug.");
      return;
    }

    try {
      var data = await DTDT.request("/api/companies/" + encodeURIComponent(slug), { auth: false });
      currentCompany = data.company;
      currentStateResponses = data.stateResponses || [];
      renderCompany(data.company, currentStateResponses);
      loadComments(data.company.id);
    } catch (error) {
      renderError(error.message || "Unable to load company.");
    }
  }

  function bindForms() {
    var commentForm = document.getElementById("commentForm");
    var suggestionForm = document.getElementById("suggestionForm");
    var logoForm = document.getElementById("logoForm");

    if (commentForm) {
      commentForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!currentCompany) return;
        await submitComment(commentForm);
      });
    }

    if (suggestionForm) {
      suggestionForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!currentCompany) return;
        await submitSuggestion(suggestionForm);
      });
    }

    if (logoForm) {
      logoForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (!currentCompany) return;
        await submitLogo(logoForm);
      });
    }

    Array.prototype.slice.call(document.querySelectorAll("[data-vote]")).forEach(function (button) {
      button.addEventListener("click", function () {
        if (currentCompany) vote(button.dataset.vote);
      });
    });
  }

  function renderCompany(company, stateResponses) {
    document.title = company.name + " - Do They Drug Test?";
    setText("companyName", company.name);
    setText("companyIndustry", companySummary(company));
    setText("discussionTitle", "Discussion for " + reportLocation(company) + " report");
    setText("companyUpdated", company.lastUpdatedAt ? new Date(company.lastUpdatedAt).toLocaleDateString() : "Unknown");
    setText("pendingSuggestions", String(company.pendingSuggestionCount || 0));
    setText("upvotes", String(company.upvotes || 0));
    setText("downvotes", String(company.downvotes || 0));
    setText("preEmploymentTesting", DTDT.formatPolicy(company.preEmploymentTesting));
    setText("randomTesting", DTDT.formatPolicy(company.randomTesting));
    setText("postAccidentTesting", DTDT.formatPolicy(company.postAccidentTesting));
    setText("reasonableSuspicionTesting", DTDT.formatPolicy(company.reasonableSuspicionTesting));
    setText("thcPolicy", company.thcPolicy || "Unknown");
    setText("remoteWorkerPolicy", company.remoteWorkerPolicy || "Unknown");
    setText("additionalNotes", company.additionalNotes || "No additional notes yet.");

    var website = document.getElementById("companyWebsite");
    if (website && company.website) {
      website.href = company.website;
      website.textContent = company.website;
      website.style.display = "inline";
    }

    var logo = document.getElementById("companyLogo");
    if (logo && company.logoUrl) {
      logo.src = company.logoUrl.indexOf("http") === 0 ? company.logoUrl : DTDT.apiBase + company.logoUrl;
      logo.alt = company.name + " logo";
      logo.style.display = "block";
    }

    renderStateResponses(company, stateResponses || []);
  }

  function renderStateResponses(company, responses) {
    var map = document.getElementById("stateMap");
    var panel = document.getElementById("stateResponsePanel");
    if (!map || !panel) return;

    var allResponses = combineStateResponses(company, responses);
    var grouped = groupResponsesByState(allResponses, company);
    var recordedStates = Object.keys(grouped).sort();
    var currentState = normalizeStateCode(company.state);
    var selectedState = currentState && grouped[currentState] ? currentState : recordedStates[0] || "";

    renderStateSummary(allResponses.length, recordedStates.length);
    map.textContent = "";

    STATE_MAP.forEach(function (state) {
      var records = grouped[state.code] || [];
      var hasRecord = records.length > 0;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "state-tile";
      button.textContent = state.code;
      button.style.gridColumn = String(state.col);
      button.style.gridRow = String(state.row);
      button.dataset.state = state.code;
      button.dataset.hasRecord = hasRecord ? "true" : "false";
      button.disabled = !hasRecord;
      button.title = state.name + (hasRecord ? " - " + records.length + " approved " + plural(records.length, "report") : " - no report");
      button.setAttribute(
        "aria-label",
        state.name + (hasRecord ? ", " + records.length + " approved " + plural(records.length, "report") : ", no report")
      );
      if (state.code === currentState) button.classList.add("is-current");
      if (state.code === selectedState) button.classList.add("is-selected");
      if (hasRecord) {
        button.addEventListener("click", function () {
          selectState(state.code, grouped, company);
        });
      }
      map.appendChild(button);
    });

    renderSelectedState(panel, selectedState, grouped, company, defaultReportIndex(selectedState, grouped, company));
  }

  function combineStateResponses(company, responses) {
    var seen = {};
    var combined = [];
    function add(response) {
      if (!response || !normalizeStateCode(response.state) || seen[response.id]) return;
      seen[response.id] = true;
      combined.push(response);
    }
    add(company);
    (responses || []).forEach(add);
    return combined;
  }

  function groupResponsesByState(responses, company) {
    var grouped = {};
    responses.forEach(function (response) {
      var state = normalizeStateCode(response.state);
      if (!state) return;
      if (!grouped[state]) grouped[state] = [];
      grouped[state].push(response);
    });

    Object.keys(grouped).forEach(function (state) {
      grouped[state].sort(function (a, b) {
        if (company && a.id === company.id) return -1;
        if (company && b.id === company.id) return 1;
        return new Date(b.lastUpdatedAt || 0).getTime() - new Date(a.lastUpdatedAt || 0).getTime();
      });
    });

    return grouped;
  }

  function renderStateSummary(responseCount, stateCount) {
    var summary = document.getElementById("stateMapSummary");
    if (!summary) return;
    if (!responseCount) {
      summary.textContent = "No location-specific reports in the database yet.";
      return;
    }
    summary.textContent =
      responseCount +
      " approved " +
      plural(responseCount, "report") +
      " across " +
      stateCount +
      " " +
      plural(stateCount, "state") +
      ".";
  }

  function selectState(stateCode, grouped, company, activeIndex) {
    Array.prototype.slice.call(document.querySelectorAll("#stateMap .state-tile")).forEach(function (button) {
      button.classList.toggle("is-selected", button.dataset.state === stateCode);
    });
    var records = grouped[stateCode] || [];
    var index = clampReportIndex(activeIndex !== undefined ? activeIndex : stateReportPageByState[stateCode] || 0, records.length);
    stateReportPageByState[stateCode] = index;
    renderSelectedState(document.getElementById("stateResponsePanel"), stateCode, grouped, company, index);
  }

  function renderSelectedState(panel, stateCode, grouped, company, activeIndex) {
    if (!panel) return;
    panel.textContent = "";

    if (!stateCode) {
      var emptyTitle = document.createElement("h3");
      emptyTitle.className = "h5 text-dark";
      emptyTitle.textContent = "No Location Reports";
      panel.appendChild(emptyTitle);

      var empty = document.createElement("p");
      empty.className = "text-muted mb-0";
      empty.textContent = "Approved reports with a state will appear here.";
      panel.appendChild(empty);
      return;
    }

    var records = grouped[stateCode] || [];
    var index = clampReportIndex(activeIndex !== undefined ? activeIndex : 0, records.length);
    var record = records[index];
    var title = document.createElement("h3");
    title.className = "h5 text-dark mb-1";
    title.textContent = stateName(stateCode) + " Reports";
    panel.appendChild(title);

    var count = document.createElement("p");
    count.className = "text-muted small";
    count.textContent = records.length ? "Report " + (index + 1) + " of " + records.length : "No approved reports";
    panel.appendChild(count);

    if (!record) return;

    if (records.length > 1) {
      panel.appendChild(stateReportPager(stateCode, grouped, company, index, records.length));
    }

    panel.appendChild(stateResponseCard(record, company));

    var comments = document.createElement("div");
    comments.className = "state-report-comments mt-3";
    comments.dataset.reportId = record.id;
    comments.textContent = "Loading comments...";
    panel.appendChild(comments);
    loadStateReportComments(record, comments);
  }

  function defaultReportIndex(stateCode, grouped, company) {
    var records = grouped[stateCode] || [];
    var currentIndex = records.findIndex(function (record) {
      return company && record.id === company.id;
    });
    return currentIndex >= 0 ? currentIndex : clampReportIndex(stateReportPageByState[stateCode] || 0, records.length);
  }

  function clampReportIndex(index, total) {
    if (!total) return 0;
    return Math.min(Math.max(Number(index) || 0, 0), total - 1);
  }

  function stateReportPager(stateCode, grouped, company, index, total) {
    var pager = document.createElement("div");
    pager.className = "state-report-pager mb-3";

    var previous = document.createElement("button");
    previous.type = "button";
    previous.className = "btn btn-sm btn-outline-primary";
    previous.textContent = "Previous report";
    previous.disabled = index <= 0;
    previous.addEventListener("click", function () {
      selectState(stateCode, grouped, company, index - 1);
    });
    pager.appendChild(previous);

    var label = document.createElement("span");
    label.className = "text-muted small";
    label.textContent = index + 1 + " / " + total;
    pager.appendChild(label);

    var next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn-sm btn-outline-primary";
    next.textContent = "Next report";
    next.disabled = index >= total - 1;
    next.addEventListener("click", function () {
      selectState(stateCode, grouped, company, index + 1);
    });
    pager.appendChild(next);

    return pager;
  }

  function stateResponseCard(record, current) {
    var article = document.createElement("article");
    article.className = "state-response-card";

    var header = document.createElement("div");
    header.className = "d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2";

    var heading = document.createElement("div");
    var name = document.createElement(record.id === current.id ? "span" : "a");
    name.className = "fw-bold text-dark";
    name.textContent = record.name || "Company record";
    if (record.id !== current.id) {
      name.href = companyHref(record);
    }
    heading.appendChild(name);

    var meta = document.createElement("div");
    meta.className = "text-muted small";
    meta.textContent = "Report location: " + reportLocation(record);
    heading.appendChild(meta);
    if (record.industry) {
      var industry = document.createElement("div");
      industry.className = "text-muted small";
      industry.textContent = "Industry: " + record.industry;
      heading.appendChild(industry);
    }
    header.appendChild(heading);

    if (record.id === current.id) {
      var currentBadge = document.createElement("span");
      currentBadge.className = "badge bg-primary";
      currentBadge.textContent = "Current";
      header.appendChild(currentBadge);
    }
    article.appendChild(header);

    var grid = document.createElement("div");
    grid.className = "state-response-grid mb-3";
    grid.appendChild(policyCell("Pre-employment", record.preEmploymentTesting));
    grid.appendChild(policyCell("Random", record.randomTesting));
    grid.appendChild(policyCell("Post-accident", record.postAccidentTesting));
    grid.appendChild(policyCell("Suspicion", record.reasonableSuspicionTesting));
    article.appendChild(grid);

    appendOptionalNote(article, "THC", record.thcPolicy);
    appendOptionalNote(article, "Remote", record.remoteWorkerPolicy);
    appendOptionalNote(article, "Notes", record.additionalNotes);

    var updated = document.createElement("p");
    updated.className = "text-muted small mb-0";
    updated.textContent = "Last updated: " + (record.lastUpdatedAt ? new Date(record.lastUpdatedAt).toLocaleDateString() : "Unknown");
    article.appendChild(updated);

    var discussion = document.createElement("a");
    discussion.className = "btn btn-sm btn-outline-primary mt-3";
    discussion.href = record.id === current.id ? "#discussionSection" : companyHref(record, "#discussionSection");
    discussion.textContent = record.id === current.id ? "Jump to this discussion" : "Open this report and discussion";
    article.appendChild(discussion);

    return article;
  }

  function policyCell(label, value) {
    var cell = document.createElement("div");
    var cellLabel = document.createElement("span");
    cellLabel.textContent = label;
    var cellValue = document.createElement("strong");
    cellValue.textContent = DTDT.formatPolicy(value);
    cell.appendChild(cellLabel);
    cell.appendChild(cellValue);
    return cell;
  }

  function appendOptionalNote(parent, label, value) {
    if (!value) return;
    var note = document.createElement("p");
    note.className = "small mb-2";
    var strong = document.createElement("strong");
    strong.textContent = label + ": ";
    note.appendChild(strong);
    note.appendChild(document.createTextNode(value));
    parent.appendChild(note);
  }

  function companySummary(company) {
    var summary = [];
    if (company.industry) summary.push(company.industry);
    summary.push("Report location: " + reportLocation(company));
    return summary.join(" / ");
  }

  function reportLocation(record) {
    var state = normalizeStateCode(record.state);
    var location = String(record.headquarters || "").trim();
    return [location, state ? stateName(state) : ""].filter(Boolean).join(", ") || "Location not listed";
  }

  function companyHref(record, hash) {
    return "company.html?slug=" + encodeURIComponent(record.slug) + (hash || "");
  }

  async function loadStateReportComments(record, container) {
    var requestId = String(++stateReportCommentRequest);
    container.dataset.requestId = requestId;
    try {
      var data = await DTDT.request("/api/companies/" + record.id + "/comments?pageSize=3", { auth: false });
      if (container.dataset.requestId !== requestId || container.dataset.reportId !== record.id) return;
      renderStateReportComments(record, container, data);
    } catch (error) {
      if (container.dataset.requestId !== requestId) return;
      container.textContent = error.message || "Unable to load comments.";
    }
  }

  function renderStateReportComments(record, container, data) {
    container.textContent = "";

    var title = document.createElement("h4");
    title.className = "h6 text-dark mb-2";
    title.textContent = "Comments for this report";
    container.appendChild(title);

    var comments = data.comments || [];
    if (!comments.length) {
      var empty = document.createElement("p");
      empty.className = "text-muted small mb-2";
      empty.textContent = "No comments yet for this report.";
      container.appendChild(empty);
    } else {
      comments.forEach(function (comment) {
        container.appendChild(stateReportCommentNode(comment));
      });
    }

    var link = document.createElement("a");
    link.className = "btn btn-sm btn-outline-primary mt-2";
    link.href = currentCompany && record.id === currentCompany.id ? "#discussionSection" : companyHref(record, "#discussionSection");
    link.textContent = data.total > comments.length ? "Open all " + data.total + " comments" : "Open discussion";
    container.appendChild(link);
  }

  function stateReportCommentNode(comment) {
    var article = document.createElement("article");
    article.className = "state-report-comment small";

    var meta = document.createElement("div");
    meta.className = "text-muted mb-1";
    meta.textContent = (comment.author && comment.author.displayName ? comment.author.displayName : "User") + " / " + new Date(comment.createdAt).toLocaleString();
    article.appendChild(meta);

    var body = document.createElement("p");
    body.className = "mb-0";
    body.textContent = comment.body;
    article.appendChild(body);

    return article;
  }

  function normalizeStateCode(value) {
    var code = String(value || "").trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) ? code : "";
  }

  function stateName(code) {
    var match = STATE_MAP.find(function (state) {
      return state.code === code;
    });
    return match ? match.name : code;
  }

  function plural(count, word) {
    return Number(count) === 1 ? word : word + "s";
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  async function loadComments(companyId) {
    var container = document.getElementById("comments");
    if (!container) return;
    container.textContent = "Loading comments...";
    try {
      var data = await DTDT.request("/api/companies/" + companyId + "/comments", { auth: false });
      container.textContent = "";
      if (!data.comments.length) {
        container.textContent = "No comments yet.";
        return;
      }
      data.comments.forEach(function (comment) {
        container.appendChild(commentNode(comment));
      });
    } catch (error) {
      container.textContent = error.message || "Unable to load comments.";
    }
  }

  function commentNode(comment) {
    var wrapper = document.createElement("article");
    wrapper.className = "border rounded p-3 mb-3";

    var meta = document.createElement("div");
    meta.className = "text-muted small mb-2";
    meta.textContent = (comment.author && comment.author.displayName ? comment.author.displayName : "User") + " / " + new Date(comment.createdAt).toLocaleString();
    wrapper.appendChild(meta);

    var body = document.createElement("p");
    body.className = "mb-0";
    body.textContent = comment.body;
    wrapper.appendChild(body);

    if (comment.replies && comment.replies.length) {
      var replies = document.createElement("div");
      replies.className = "ms-3 mt-3";
      comment.replies.forEach(function (reply) {
        replies.appendChild(commentNode(reply));
      });
      wrapper.appendChild(replies);
    }

    return wrapper;
  }

  async function submitComment(form) {
    var message = form.querySelector(".form-message");
    try {
      await DTDT.request("/api/companies/" + currentCompany.id + "/comments", {
        method: "POST",
        body: Object.fromEntries(new FormData(form).entries())
      });
      DTDT.showMessage(message, "Comment submitted.", "success");
      form.reset();
      loadComments(currentCompany.id);
    } catch (error) {
      DTDT.showMessage(message, error.message || "Unable to comment.", "danger");
    }
  }

  async function submitSuggestion(form) {
    var message = form.querySelector(".form-message");
    var data = Object.fromEntries(new FormData(form).entries());
    var proposedFields = {};
    ["preEmploymentTesting", "randomTesting", "postAccidentTesting", "reasonableSuspicionTesting", "thcPolicy", "remoteWorkerPolicy", "additionalNotes"].forEach(function (field) {
      if (data[field]) proposedFields[field] = data[field];
    });

    try {
      await DTDT.request("/api/companies/" + currentCompany.id + "/suggestions", {
        method: "POST",
        body: {
          proposedFields: proposedFields,
          note: data.note
        }
      });
      DTDT.showMessage(message, "Suggestion sent to moderation.", "success");
      form.reset();
    } catch (error) {
      DTDT.showMessage(message, error.message || "Unable to submit suggestion.", "danger");
    }
  }

  async function submitLogo(form) {
    var message = form.querySelector(".form-message");
    try {
      var data = new FormData(form);
      await DTDT.request("/api/companies/" + currentCompany.id + "/logos", {
        method: "POST",
        body: data
      });
      DTDT.showMessage(message, "Logo uploaded for moderator review.", "success");
      form.reset();
    } catch (error) {
      DTDT.showMessage(message, error.message || "Unable to upload logo.", "danger");
    }
  }

  async function vote(value) {
    try {
      await DTDT.request("/api/companies/" + currentCompany.id + "/votes", {
        method: "POST",
        body: { value: value }
      });
      loadCompany();
    } catch (error) {
      alert(error.message || "Login required to vote.");
    }
  }

  function renderError(message) {
    var page = document.getElementById("companyPage");
    if (!page) return;
    page.textContent = "";
    var alert = document.createElement("div");
    alert.className = "alert alert-danger";
    alert.textContent = message;
    page.appendChild(alert);
  }
})();
