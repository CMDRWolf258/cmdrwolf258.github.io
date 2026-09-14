(function setupMiningReportForm() {
  const PAGES_ORIGIN = "https://ten16-archive.pages.dev";
  const isPagesSite = window.location.origin === PAGES_ORIGIN;

  const form = document.getElementById("mining-report-form");
  const authCopy = document.getElementById("mining-auth-copy");
  const authActions = document.getElementById("mining-auth-actions");
  const commodityList = document.getElementById("report-commodity-list");
  const bodyInput = document.getElementById("report-body");
  const bodyTypeSelect = document.getElementById("report-body-type");
  const submitButton = document.getElementById("mining-report-submit");
  const statusElement = document.getElementById("mining-report-status");
  const adminLink = document.getElementById("mining-admin-link");

  if (!form || !authCopy || !authActions) {
    return;
  }

  function settleSubmissionAnchor() {
    if (window.location.hash !== "#submit-mining-report") {
      return;
    }

    const target = document.getElementById("submit-mining-report");
    if (!target) {
      return;
    }

    const scrollToTarget = () => {
      target.scrollIntoView({ block: "start" });
    };

    requestAnimationFrame(scrollToTarget);
    setTimeout(scrollToTarget, 250);
    setTimeout(scrollToTarget, 900);
  }

  function authButton(href, label, className) {
    const link = document.createElement("a");
    link.href = href;
    link.className = className;
    link.textContent = label;
    return link;
  }

  async function loadSession() {
    if (!isPagesSite) {
      authCopy.innerHTML =
        "Discord-authenticated submissions are available on the new 10-16 Cloudflare site.";
      authActions.innerHTML = "";
      authActions.appendChild(
        authButton(
          `${PAGES_ORIGIN}/mining.html#submit-mining-report`,
          "Open Submission Site",
          "mining-login-button"
        )
      );
      return;
    }

    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Unable to check Discord session.");
      }

      const session = await response.json();
      authActions.innerHTML = "";

      if (adminLink) {
        adminLink.hidden = !session.canReviewMining;
      }

      if (!session.authenticated) {
        authCopy.innerHTML =
          "Sign in with Discord to verify your <strong>Mongrel member</strong> role and unlock submissions.";

        authActions.appendChild(
          authButton(
            "/api/auth/login?return=%2Fmining.html%23submit-mining-report",
            "Sign in with Discord",
            "mining-login-button"
          )
        );
        return;
      }

      if (!session.canSubmitMining) {
        authCopy.innerHTML =
          `Signed in as <strong>${escapeHtml(session.displayName || session.username || "Discord user")}</strong>, but the Mongrel member role is required to submit reports.`;

        authActions.appendChild(
          authButton(
            "/api/auth/logout?return=%2Fmining.html%23submit-mining-report",
            "Sign Out",
            "mining-logout-button"
          )
        );
        return;
      }

      authCopy.innerHTML =
        `Signed in as <strong>${escapeHtml(session.displayName || session.username || "Mongrel member")}</strong> · ${escapeHtml(session.accessLabel || "Mongrel Member")}`;

      if (session.canReviewMining) {
        authActions.appendChild(
          authButton(
            "/mining-admin.html",
            "Review Submissions",
            "mining-admin-button"
          )
        );
      }

      authActions.appendChild(
        authButton(
          "/api/auth/logout?return=%2Fmining.html%23submit-mining-report",
          "Sign Out",
          "mining-logout-button"
        )
      );

      form.hidden = false;
      settleSubmissionAnchor();
    } catch (error) {
      console.error("Discord session error:", error);
      authCopy.textContent =
        "Discord access could not be verified right now. Please refresh and try again.";
    }
  }

  fetch("/api/mining", { cache: "no-store" })
    .then(response => {
      if (!response.ok) {
        throw new Error("Unable to load commodity list.");
      }
      return response.json();
    })
    .then(sites => {
      const commodities = [
        ...new Set(sites.map(site => site.commodity))
      ].sort((a, b) => a.localeCompare(b));

      commodityList.innerHTML = "";

      commodities.forEach(commodity => {
        const option = document.createElement("option");
        option.value = commodity;
        commodityList.appendChild(option);
      });
    })
    .catch(error => {
      console.warn("Commodity suggestions unavailable:", error);
    });

  bodyInput.addEventListener("input", () => {
    const body = bodyInput.value.trim();

    if (/^\d+$/.test(body)) {
      bodyTypeSelect.value = "planet";
    } else if (/^\d+[a-z]+$/i.test(body)) {
      bodyTypeSelect.value = "moon";
    }
  });

  form.addEventListener("keydown", event => {
    if (event.key !== "Enter") {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") {
      return;
    }

    if (target.tagName !== "INPUT" && target.tagName !== "SELECT") {
      return;
    }

    event.preventDefault();

    const fields = [...form.querySelectorAll(
      "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])"
    )].filter(element => !element.hidden && element.offsetParent !== null);

    const currentIndex = fields.indexOf(target);
    const nextField = fields[currentIndex + 1];

    if (nextField) {
      nextField.focus();
      if (typeof nextField.select === "function" && nextField.tagName === "INPUT") {
        nextField.select();
      }
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    statusElement.className = "mining-report-status";
    statusElement.textContent = "";

    const formData = new FormData(form);
    const latitude = formData.get("latitude").trim();
    const longitude = formData.get("longitude").trim();

    if ((latitude && !longitude) || (!latitude && longitude)) {
      statusElement.classList.add("error");
      statusElement.textContent =
        "Enter both latitude and longitude, or leave both blank.";
      return;
    }

    const payload = {
      reportType: "add",
      commodity: formData.get("commodity").trim(),
      body: formData.get("body").trim(),
      bodyType: formData.get("bodyType"),
      signal: Number(formData.get("signal")),
      latitude: latitude === "" ? null : Number(latitude),
      longitude: longitude === "" ? null : Number(longitude),
      rigs:
        formData.get("rigs").trim() === ""
          ? null
          : Number(formData.get("rigs")),
      preferred: false,
      notes: formData.get("notes").trim()
    };

    submitButton.disabled = true;
    submitButton.textContent = "Submitting...";
    statusElement.textContent = "Sending report...";

    try {
      const response = await fetch("/api/mining-reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message || "Unable to submit mining report."
        );
      }

      form.reset();
      bodyTypeSelect.value = "moon";

      statusElement.className =
        "mining-report-status success";

      statusElement.textContent = result.reportId
        ? `Report #${result.reportId} submitted for review as ${result.submittedBy}.`
        : "Mining report submitted for review.";
    } catch (error) {
      console.error("Mining report submission error:", error);

      statusElement.className =
        "mining-report-status error";

      statusElement.textContent =
        error.message || "Unable to submit mining report.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Submit for Review";
    }
  });

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  loadSession();
  settleSubmissionAnchor();
})();
