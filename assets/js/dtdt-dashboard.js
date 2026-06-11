(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var mode = document.body.dataset.dashboard;
    if (mode === "moderator") loadModerationQueue();
    if (mode === "admin") loadAdminDashboard();
  });

  async function loadModerationQueue() {
    var target = document.getElementById("dashboardContent");
    if (!target) return;
    target.textContent = "Loading moderation queue...";
    try {
      var data = await DTDT.request("/api/moderation/queue");
      target.textContent = "";
      target.appendChild(queueSection("Submissions", data.submissions, "submissions"));
      target.appendChild(queueSection("Suggestions", data.suggestions, "suggestions"));
      target.appendChild(queueSection("Logos", data.logos, "logos"));
      target.appendChild(queueSection("Flagged Comments", data.flaggedComments, "comments"));
    } catch (error) {
      target.textContent = "";
      target.appendChild(alertNode(error.message, "danger"));
    }
  }

  function queueSection(title, items, type) {
    var section = document.createElement("section");
    section.className = "mb-4";
    var heading = document.createElement("h2");
    heading.className = "h4 text-dark";
    heading.textContent = title + " (" + (items ? items.length : 0) + ")";
    section.appendChild(heading);

    if (!items || !items.length) {
      var empty = document.createElement("p");
      empty.className = "text-muted";
      empty.textContent = "Nothing waiting here.";
      section.appendChild(empty);
      return section;
    }

    items.forEach(function (item) {
      section.appendChild(queueItem(item, type));
    });
    return section;
  }

  function queueItem(item, type) {
    var article = document.createElement("article");
    article.className = "border rounded p-3 mb-3";

    var title = document.createElement("h3");
    title.className = "h6 text-dark";
    title.textContent = item.type || item.originalName || (item.company && item.company.name) || "Moderation item";
    article.appendChild(title);

    var meta = document.createElement("p");
    meta.className = "text-muted small";
    meta.textContent =
      "Status: " +
      item.status +
      " | By: " +
      ((item.submitter && item.submitter.displayName) || (item.author && item.author.displayName) || item.displayName || "Unknown") +
      " | Created: " +
      new Date(item.createdAt).toLocaleString();
    article.appendChild(meta);

    var body = document.createElement("pre");
    body.className = "bg-light p-2 rounded";
    body.style.whiteSpace = "pre-wrap";
    body.textContent = JSON.stringify(item.payload || item.proposedFields || item.body || item.storagePath || {}, null, 2);
    article.appendChild(body);

    if (item.flagReasons && item.flagReasons.length) {
      var flags = document.createElement("p");
      flags.className = "text-danger";
      flags.textContent = "Flags: " + item.flagReasons.join(", ");
      article.appendChild(flags);
    }

    var approve = document.createElement("button");
    approve.className = "btn btn-success btn-sm me-2";
    approve.type = "button";
    approve.textContent = type === "comments" ? "Approve" : "Approve";
    approve.addEventListener("click", function () {
      moderate(type, item.id, type === "comments" ? "approve" : "approve");
    });
    article.appendChild(approve);

    var reject = document.createElement("button");
    reject.className = "btn btn-outline-danger btn-sm";
    reject.type = "button";
    reject.textContent = type === "comments" ? "Hide" : "Reject";
    reject.addEventListener("click", function () {
      moderate(type, item.id, type === "comments" ? "hide" : "reject");
    });
    article.appendChild(reject);

    return article;
  }

  async function moderate(type, id, action) {
    var path = "/api/moderation/" + type + "/" + id + "/" + action;
    try {
      await DTDT.request(path, {
        method: "POST",
        body: { note: "" }
      });
      loadModerationQueue();
    } catch (error) {
      alert(error.message || "Moderation action failed.");
    }
  }

  async function loadAdminDashboard() {
    var target = document.getElementById("dashboardContent");
    if (!target) return;
    target.textContent = "Loading admin dashboard...";
    try {
      var metrics = await DTDT.request("/api/admin/metrics");
      var users = await DTDT.request("/api/admin/users?pageSize=25");
      target.textContent = "";
      target.appendChild(metricCards(metrics));
      target.appendChild(usersTable(users.users || []));
    } catch (error) {
      target.textContent = "";
      target.appendChild(alertNode(error.message, "danger"));
    }
  }

  function metricCards(metrics) {
    var wrapper = document.createElement("div");
    wrapper.className = "row g-3 mb-4";
    [
      ["Total users", metrics.users.totalUsers],
      ["Verified users", metrics.users.verifiedUsers],
      ["Companies", metrics.content.companyCount],
      ["Pending companies", metrics.content.pendingCompanies],
      ["Pending suggestions", metrics.content.pendingSuggestions],
      ["Daily searches", metrics.searches.dailySearches],
      ["Monthly searches", metrics.searches.monthlySearches],
      ["Queue size", metrics.system.queueSize]
    ].forEach(function (entry) {
      var column = document.createElement("div");
      column.className = "col-md-3";
      var card = document.createElement("div");
      card.className = "border rounded p-3";
      var label = document.createElement("div");
      label.className = "text-muted small";
      label.textContent = entry[0];
      var value = document.createElement("div");
      value.className = "h4 mb-0 text-dark";
      value.textContent = String(entry[1]);
      card.appendChild(label);
      card.appendChild(value);
      column.appendChild(card);
      wrapper.appendChild(column);
    });
    return wrapper;
  }

  function usersTable(users) {
    var section = document.createElement("section");
    var heading = document.createElement("h2");
    heading.className = "h4 text-dark";
    heading.textContent = "Users";
    section.appendChild(heading);

    var table = document.createElement("table");
    table.className = "table table-sm align-middle";
    table.appendChild(tableHead(["Email", "Display", "Role", "Verified", "Quota override", ""]));
    var body = document.createElement("tbody");
    users.forEach(function (user) {
      var row = document.createElement("tr");
      ["email", "displayName", "role", "verificationStatus"].forEach(function (key) {
        var cell = document.createElement("td");
        cell.textContent = user[key] || "";
        row.appendChild(cell);
      });
      var quotaCell = document.createElement("td");
      var input = document.createElement("input");
      input.className = "form-control form-control-sm";
      input.type = "number";
      input.min = "0";
      input.value = user.searchQuotaOverride == null ? "" : String(user.searchQuotaOverride);
      quotaCell.appendChild(input);
      row.appendChild(quotaCell);

      var actionCell = document.createElement("td");
      var save = document.createElement("button");
      save.className = "btn btn-primary btn-sm";
      save.textContent = "Save";
      save.addEventListener("click", function () {
        saveQuota(user.id, input.value);
      });
      actionCell.appendChild(save);
      row.appendChild(actionCell);
      body.appendChild(row);
    });
    table.appendChild(body);
    section.appendChild(table);
    return section;
  }

  async function saveQuota(userId, value) {
    try {
      await DTDT.request("/api/admin/users/" + userId + "/quota", {
        method: "PATCH",
        body: {
          searchQuotaOverride: value === "" ? null : Number(value)
        }
      });
      alert("Quota saved.");
    } catch (error) {
      alert(error.message || "Unable to save quota.");
    }
  }

  function alertNode(message, type) {
    var alert = document.createElement("div");
    alert.className = "alert alert-" + type;
    alert.textContent = message || "Request failed.";
    return alert;
  }

  function tableHead(labels) {
    var head = document.createElement("thead");
    var row = document.createElement("tr");
    labels.forEach(function (label) {
      var cell = document.createElement("th");
      cell.textContent = label;
      row.appendChild(cell);
    });
    head.appendChild(row);
    return head;
  }
})();
