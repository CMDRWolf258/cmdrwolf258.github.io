(function setupMaterialAmountUI() {
  const resultsContainer = document.getElementById("mining-results");
  if (!resultsContainer) return;

  const labels = {
    high: "HIGH",
    medium: "MEDIUM",
    low: "LOW",
    depleted: "DEPLETED"
  };

  let miningSites = [];
  let canSubmit = false;
  let renderQueued = false;

  function parseStoredDate(value) {
    if (!value) return null;
    let normalized = String(value).trim();
    if (!/[zZ]$/.test(normalized) && !/[+-]\d\d:?\d\d$/.test(normalized)) {
      normalized = `${normalized.replace(" ", "T")}Z`;
    }
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function statusDisplay(site) {
    const amount = String(site?.materialAmount || "").toLowerCase();
    if (!labels[amount]) {
      return {
        amount: "unknown",
        label: "UNKNOWN",
        ageText: "No amount reported yet",
        stale: false
      };
    }

    const updated = parseStoredDate(site.materialUpdatedAt);
    if (!updated) {
      return {
        amount,
        label: labels[amount],
        ageText: "Report time unavailable",
        stale: false
      };
    }

    const ageMs = Math.max(0, Date.now() - updated.getTime());
    const hours = Math.floor(ageMs / 3600000);
    const stale = ageMs >= 48 * 3600000;

    let ageText;
    if (hours < 1) {
      ageText = "Reported <1h ago";
    } else if (hours < 24) {
      ageText = `Reported ${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      ageText = `${stale ? "STALE · " : ""}Reported ${days}d ago`;
    }

    return { amount, label: labels[amount], ageText, stale };
  }

  function parseBodyLabel(value) {
    const match = String(value || "").trim().match(/^(Moon|Planet)\s+(.+?)(?:\s+[—-]|$)/i);
    if (!match) return null;
    return {
      bodyType: match[1].toLowerCase() === "moon" ? "moon" : "planet",
      body: match[2].trim()
    };
  }

  function parseSignal(value) {
    const match = String(value || "").match(/Signal\s*#\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function parseCoordinates(value) {
    const match = String(value || "").match(/Coordinates:\s*(-?\d+(?:\.\d+)?)\s*,?\s*(-?\d+(?:\.\d+)?)/i);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  function sameNumber(a, b) {
    return Number.isFinite(Number(a)) && Number.isFinite(Number(b)) &&
      Math.abs(Number(a) - Number(b)) < 0.000001;
  }

  function findCompactSite(card) {
    const commodity = String(card.querySelector(".location-type")?.textContent || "")
      .replace(/\s*\/\/\s*PRIMARY\s*$/i, "")
      .trim();
    const heading = card.querySelector("h4")?.textContent || "";
    const bodyInfo = parseBodyLabel(heading);
    const signal = parseSignal(heading);
    const coordinates = parseCoordinates(card.querySelector(".mining-coordinates")?.textContent || "");

    if (!commodity || !bodyInfo || !signal) return null;

    return miningSites.find(site => {
      if (String(site.commodity).toLowerCase() !== commodity.toLowerCase()) return false;
      if (String(site.bodyType).toLowerCase() !== bodyInfo.bodyType) return false;
      if (String(site.body).toLowerCase() !== bodyInfo.body.toLowerCase()) return false;
      if (Number(site.signal) !== signal) return false;
      if (coordinates) {
        return sameNumber(site.latitude, coordinates[0]) && sameNumber(site.longitude, coordinates[1]);
      }
      return site.latitude == null || site.longitude == null;
    }) || null;
  }

  function findGroupedSite(row) {
    const commodity = row.closest("#mining-results")?.querySelector(".mining-group-commodity")?.textContent?.trim() || "";
    const bodyHeading = row.closest(".mining-body-group")?.querySelector(".mining-body-heading")?.textContent || "";
    const signalHeading = row.closest(".mining-signal-group")?.querySelector(".mining-signal-heading")?.textContent || "";
    const bodyInfo = parseBodyLabel(bodyHeading);
    const signal = parseSignal(signalHeading);
    const coordinates = parseCoordinates(row.querySelector(".mining-location-coordinates")?.textContent || "");

    if (!commodity || !bodyInfo || !signal) return null;

    const candidates = miningSites.filter(site =>
      String(site.commodity).toLowerCase() === commodity.toLowerCase() &&
      String(site.bodyType).toLowerCase() === bodyInfo.bodyType &&
      String(site.body).toLowerCase() === bodyInfo.body.toLowerCase() &&
      Number(site.signal) === signal
    );

    if (coordinates) {
      return candidates.find(site =>
        sameNumber(site.latitude, coordinates[0]) && sameNumber(site.longitude, coordinates[1])
      ) || null;
    }

    return candidates.find(site => site.latitude == null || site.longitude == null) || candidates[0] || null;
  }

  function createStatusControl(site) {
    const display = statusDisplay(site);
    const wrapper = document.createElement("div");
    wrapper.className = "material-status-control";
    wrapper.dataset.siteId = String(site.id);

    const summary = document.createElement("div");
    summary.className = "material-status-summary";

    const title = document.createElement("span");
    title.className = "material-status-label";
    title.textContent = "MATERIAL AMOUNT";

    const badge = document.createElement(canSubmit ? "button" : "span");
    badge.className = `material-status-badge material-${display.amount}${display.stale ? " stale" : ""}${canSubmit ? " material-status-trigger" : ""}`;
    badge.textContent = display.label;

    if (canSubmit) {
      badge.type = "button";
      badge.title = "Update material amount";
      badge.setAttribute("aria-label", `Update material amount. Current amount: ${display.label}`);
      badge.setAttribute("aria-haspopup", "true");
      badge.setAttribute("aria-expanded", "false");
      badge.style.cursor = "pointer";
      badge.style.appearance = "none";
    }

    const age = document.createElement("span");
    age.className = `material-status-age${display.stale ? " stale" : ""}`;
    age.textContent = display.ageText;

    summary.append(title, badge, age);
    wrapper.appendChild(summary);

    return wrapper;
  }

  function enhanceVisibleSites() {
    if (!miningSites.length) return;

    resultsContainer.querySelectorAll(".location-card.mining-site").forEach(card => {
      if (card.querySelector(":scope > .material-status-control")) return;
      const site = findCompactSite(card);
      if (site?.id) card.appendChild(createStatusControl(site));
    });

    resultsContainer.querySelectorAll(".mining-location-row").forEach(row => {
      if (row.querySelector(":scope > .material-status-control")) return;
      const site = findGroupedSite(row);
      if (site?.id) row.appendChild(createStatusControl(site));
    });
  }

  function queueEnhance() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      enhanceVisibleSites();
    });
  }

  function closePickers(except = null) {
    resultsContainer.querySelectorAll(".material-report-picker").forEach(picker => {
      if (picker === except) return;
      const control = picker.closest(".material-status-control");
      control?.querySelector(".material-status-trigger")?.setAttribute("aria-expanded", "false");
      picker.remove();
    });
  }

  resultsContainer.addEventListener("click", async event => {
    const closeButton = event.target.closest(".material-report-close");
    if (closeButton) {
      event.preventDefault();
      event.stopPropagation();
      const control = closeButton.closest(".material-status-control");
      control?.querySelector(".material-status-trigger")?.setAttribute("aria-expanded", "false");
      closeButton.closest(".material-report-picker")?.remove();
      return;
    }

    const trigger = event.target.closest(".material-status-trigger");
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();

      const control = trigger.closest(".material-status-control");
      if (!control) return;

      const existing = control.querySelector(".material-report-picker");
      if (existing) {
        trigger.setAttribute("aria-expanded", "false");
        existing.remove();
        return;
      }

      closePickers();
      const picker = document.createElement("div");
      picker.className = "material-report-picker";
      picker.innerHTML = `
        <span class="material-report-picker-label">Update material amount</span>
        <div class="material-report-options">
          <button type="button" data-material-amount="high">High</button>
          <button type="button" data-material-amount="medium">Medium</button>
          <button type="button" data-material-amount="low">Low</button>
          <button type="button" data-material-amount="depleted">Depleted</button>
          <button type="button" class="material-report-close">Close</button>
        </div>
        <span class="material-report-message" aria-live="polite"></span>
      `;
      control.appendChild(picker);
      trigger.setAttribute("aria-expanded", "true");
      return;
    }

    const amountButton = event.target.closest("[data-material-amount]");
    if (!amountButton) return;

    event.preventDefault();
    event.stopPropagation();

    const control = amountButton.closest(".material-status-control");
    const picker = amountButton.closest(".material-report-picker");
    const message = picker?.querySelector(".material-report-message");
    const siteId = Number(control?.dataset.siteId);
    const amount = amountButton.dataset.materialAmount;

    if (!Number.isInteger(siteId) || !labels[amount]) {
      if (message) message.textContent = "Unable to identify this mining site.";
      return;
    }

    const optionButtons = [...picker.querySelectorAll("[data-material-amount]")];
    optionButtons.forEach(button => { button.disabled = true; });
    if (message) message.textContent = "Saving...";

    try {
      const response = await fetch("/api/mining-material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, amount })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to update material amount.");
      }

      if (result.status === "applied") {
        const site = miningSites.find(item => Number(item.id) === siteId);
        if (site) {
          site.materialAmount = result.amount;
          site.materialUpdatedAt = result.updatedAt;
          site.materialUpdatedBy = result.updatedBy || "";
        }

        const replacement = createStatusControl(site || {
          id: siteId,
          materialAmount: result.amount,
          materialUpdatedAt: result.updatedAt,
          materialUpdatedBy: result.updatedBy || ""
        });
        control.replaceWith(replacement);

        const statusLine = document.getElementById("mining-results-status");
        if (statusLine) {
          statusLine.classList.remove("material-error");
          statusLine.classList.add("material-success");
          statusLine.textContent = `${labels[result.amount]} material amount saved.`;
        }
      } else {
        if (message) {
          message.classList.remove("error");
          message.classList.add("success");
          message.textContent = "Submitted for review.";
        }
        setTimeout(() => {
          control?.querySelector(".material-status-trigger")?.setAttribute("aria-expanded", "false");
          picker?.remove();
        }, 1800);
      }
    } catch (error) {
      console.error("Material amount report failed:", error);
      optionButtons.forEach(button => { button.disabled = false; });
      if (message) {
        message.classList.add("error");
        message.textContent = error.message || "Unable to update material amount.";
      }
    }
  });

  const observer = new MutationObserver(() => queueEnhance());
  observer.observe(resultsContainer, { childList: true, subtree: true });

  Promise.all([
    fetch("/api/mining", { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error("Unable to load material status data.");
      return response.json();
    }),
    fetch("/api/auth/session", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null)
  ])
    .then(([sites, session]) => {
      miningSites = Array.isArray(sites) ? sites : [];
      canSubmit = Boolean(session?.authenticated && session?.canSubmitMining);
      document.body.classList.toggle("material-report-enabled", canSubmit);
      queueEnhance();
    })
    .catch(error => {
      console.warn("Material amount UI unavailable:", error);
    });
})();
