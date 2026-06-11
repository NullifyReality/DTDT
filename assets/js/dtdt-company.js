(function () {
  "use strict";

  var currentCompany = null;

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
      renderCompany(data.company);
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

  function renderCompany(company) {
    document.title = company.name + " - Do They Drug Test?";
    setText("companyName", company.name);
    setText("companyIndustry", [company.industry, company.state].filter(Boolean).join(" / "));
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
