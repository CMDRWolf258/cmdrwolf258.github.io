(function setupMaterialAmountUI() {
  const resultsContainer = document.getElementById('mining-results');
  if (!resultsContainer) return;

  const labels = {
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    depleted: 'DEPLETED'
  };

  let miningSites = [];
  let canSubmit = false;
  let renderQueued = false;

  function parseStoredDate(value) {
    if (!value) return null;
    let normalized = String(value).trim();
    if (!/[zZ]$/.test(normalized) && !/[+-]\d\d:?\d\d$/.test(normalized)) {
      normalized = `${normalized.replace(' ', 'T')}Z`;
    }
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function materialDisplay(site) {
    const amount = String(site?.materialAmount || '').toLowerCase();
    if (!labels[amount]) {
      return {
        amount: 'unknown',
        label: 'UNKNOWN',
        ageText: 'No amount reported yet',
        stale: false
      };
    }

    const updated = parseStoredDate(site.materialUpdatedAt);
    if (!updated) {
      return {
        amount,
        label: labels[amount],
        ageText: 'Report time unavailable',
        stale: false
      };
    }

    const ageMs = Math.max(0, Date.now() - updated.getTime());
    const hours = Math.floor(ageMs / 3600000);
    const stale = ageMs >= 48 * 3600000;
    let ageText;

    if (hours < 1) ageText = 'Reported <1h ago';
    else if (hours < 24) ageText = `Reported ${hours}h ago`;
    else ageText = `${stale ? 'STALE · ' : ''}Reported ${Math.floor(hours / 24)}d ago`;

    return { amount, label: labels[amount], ageText, stale };
  }

  function parseBodyLabel(value) {
    const match = String(value || '').trim().match(/^(Moon|Planet)\s+(.+?)(?:\s+[—-]|$)/i);
    if (!match) return null;
    return {
      bodyType: match[1].toLowerCase() === 'moon' ? 'moon' : 'planet',
      body: match[2].trim()
    };
  }

  function parseSignal(value) {
    const match = String(value || '').match(/Signal\s*#\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function parseCoordinates(value) {
    const match = String(value || '').match(/Coordinates:\s*(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)/i);
    return match ? [Number(match[1]), Number(match[2])] : null;
  }

  function sameNumber(a, b) {
    return Math.abs(Number(a) - Number(b)) < 0.000001;
  }

  function findSiteForCompactCard(card) {
    const commodity = String(card.querySelector('.location-type')?.textContent || '')
      .replace(/\s*\/\/\s*PRIMARY\s*$/i, '')
      .trim();
    const heading = card.querySelector('h4')?.textContent || '';
    const bodyInfo = parseBodyLabel(heading);
    const signal = parseSignal(heading);
    const coords = parseCoordinates(card.querySelector('.mining-coordinates')?.textContent || '');

    if (!commodity || !bodyInfo || !signal) return null;

    return miningSites.find(site => {
      if (String(site.commodity).toLowerCase() !== commodity.toLowerCase()) return false;
      if (String(site.bodyType).toLowerCase() !== bodyInfo.bodyType) return false;
      if (String(site.body).toLowerCase() !== bodyInfo.body.toLowerCase()) return false;
      if (Number(site.signal) !== signal) return false;
      if (coords) {
        return sameNumber(site.latitude, coords[0]) && sameNumber(site.longitude, coords[1]);
      }
      return site.latitude == null || site.longitude == null;
    }) || null;
  }

  function findSiteForGroupedRow(row) {
    const commodity = resultsContainer.querySelector('.mining-group-commodity')?.textContent?.trim() || '';
    const bodyHeading = row.closest('.mining-body-group')?.querySelector('.mining-body-heading')?.textContent || '';
    const signalHeading = row.closest('.mining-signal-group')?.querySelector('.mining-signal-heading')?.textContent || '';
    const bodyInfo = parseBodyLabel(bodyHeading);
    const signal = parseSignal(signalHeading);
    const coords = parseCoordinates(row.querySelector('.mining-location-coordinates')?.textContent || '');

    if (!commodity || !bodyInfo || !signal) return null;

    const candidates = miningSites.filter(site =>
      String(site.commodity).toLowerCase() === commodity.toLowerCase() &&
      String(site.bodyType).toLowerCase() === bodyInfo.bodyType &&
      String(site.body).toLowerCase() === bodyInfo.body.toLowerCase() &&
      Number(site.signal) === signal
    );

    if (coords) {
      return candidates.find(site =>
        sameNumber(site.latitude, coords[0]) && sameNumber(site.longitude, coords[1])
      ) || null;
    }

    return candidates.find(site => site.latitude == null || site.longitude == null) || candidates[0] || null;
  }

  function createStatusControl(site) {
    const display = materialDisplay(site);
    const wrapper = document.createElement('div');
    wrapper.className = 'material-status-control';
    wrapper.dataset.siteId = String(site.id);

    const summary = document.createElement('div');
    summary.className = 'material-status-summary';

    const label = document.createElement('span');
    label.className = 'material-status-label';
    label.textContent = 'MATERIAL AMOUNT';

    const badge = document.createElement('span');
    badge.className = `material-status-badge material-${display.amount}${display.stale ? ' stale' : ''}`;
    badge.textContent = display.label;

    const age = document.createElement('span');
    age.className = `material-status-age${display.stale ? ' stale' : ''}`;
    age.textContent = display.ageText;

    summary.append(label, badge, age);
    wrapper.appendChild(summary);

    if (canSubmit) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'material-report-button';
      button.textContent = 'Update Amount';
      wrapper.appendChild(button);
    }

    return wrapper;
  }

  function enhanceVisibleSites() {
    if (!miningSites.length) return;

    resultsContainer.querySelectorAll('.material-status-control').forEach(element => element.remove());

    resultsContainer.querySelectorAll('.location-card.mining-site').forEach(card => {
      const site = findSiteForCompactCard(card);
      if (site?.id) card.appendChild(createStatusControl(site));
    });

    resultsContainer.querySelectorAll('.mining-location-row').forEach(row => {
      const site = findSiteForGroupedRow(row);
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
    resultsContainer.querySelectorAll('.material-report-picker').forEach(picker => {
      if (picker !== except) picker.remove();
    });
  }

  resultsContainer.addEventListener('click', async event => {
    const updateButton = event.target.closest('.material-report-button');
    if (updateButton) {
      event.preventDefault();
      event.stopPropagation();

      const control = updateButton.closest('.material-status-control');
      if (!control) return;

      const existing = control.querySelector('.material-report-picker');
      if (existing) {
        existing.remove();
        return;
      }

      closePickers();

      const picker = document.createElement('div');
      picker.className = 'material-report-picker';
      picker.innerHTML = `
        <span class="material-report-picker-label">Set material amount</span>
        <div class="material-report-options">
          <button type="button" data-material-amount="high">High</button>
          <button type="button" data-material-amount="medium">Medium</button>
          <button type="button" data-material-amount="low">Low</button>
          <button type="button" data-material-amount="depleted">Depleted</button>
        </div>
        <span class="material-report-message" aria-live="polite"></span>
      `;
      control.appendChild(picker);
      return;
    }

    const amountButton = event.target.closest('[data-material-amount]');
    if (!amountButton) return;

    event.preventDefault();
    event.stopPropagation();

    const control = amountButton.closest('.material-status-control');
    const picker = amountButton.closest('.material-report-picker');
    const message = picker?.querySelector('.material-report-message');
    const siteId = Number(control?.dataset.siteId);
    const amount = amountButton.dataset.materialAmount;

    if (!Number.isInteger(siteId) || !labels[amount]) {
      if (message) message.textContent = 'Unable to identify this mining site.';
      return;
    }

    const optionButtons = [...picker.querySelectorAll('[data-material-amount]')];
    optionButtons.forEach(button => { button.disabled = true; });
    if (message) message.textContent = 'Saving...';

    try {
      const response = await fetch('/api/mining-material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, amount })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Unable to update material amount.');
      }

      if (result.status === 'applied') {
        const site = miningSites.find(item => Number(item.id) === siteId);
        if (site) {
          site.materialAmount = result.amount;
          site.materialUpdatedAt = result.updatedAt;
          site.materialUpdatedBy = result.updatedBy || '';
        }
        queueEnhance();
        const resultsStatus = document.getElementById('mining-results-status');
        if (resultsStatus) {
          resultsStatus.classList.remove('material-error');
          resultsStatus.classList.add('material-success');
          resultsStatus.textContent = `${labels[result.amount]} material amount saved.`;
        }
      } else {
        if (message) {
          message.textContent = 'Submitted for review.';
          message.classList.add('success');
        }
        setTimeout(() => picker?.remove(), 1800);
      }
    } catch (error) {
      console.error('Material amount report failed:', error);
      if (message) {
        message.textContent = error.message || 'Unable to update material amount.';
        message.classList.add('error');
      }
      optionButtons.forEach(button => { button.disabled = false; });
    }
  });

  const observer = new MutationObserver(queueEnhance);
  observer.observe(resultsContainer, { childList: true, subtree: true });

  Promise.all([
    fetch('/api/mining', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('Unable to load material status data.');
      return response.json();
    }),
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .catch(() => null)
  ])
    .then(([sites, session]) => {
      miningSites = Array.isArray(sites) ? sites : [];
      canSubmit = Boolean(session?.authenticated && session?.canSubmitMining);
      queueEnhance();
    })
    .catch(error => {
      console.warn('Material amount UI unavailable:', error);
    });
})();
