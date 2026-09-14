(function setupMiningDatabase() {
  const searchBox = document.getElementById("mining-search");
  const commodityFilter = document.getElementById("commodity-filter");
  const resultsContainer = document.getElementById("mining-results");
  const resultsStatus = document.getElementById("mining-results-status");
  const commodityIndex = document.getElementById("commodity-index");
  const marketDemandFilter = document.getElementById("market-demand-filter");
  const marketSort = document.getElementById("market-sort");

  if (!searchBox || !commodityFilter || !resultsContainer || !resultsStatus) {
    return;
  }

  const marketNameMap = {
    Diamonds: "Diamond",
    LTD: "Low Temperature Diamonds"
  };

  const normalizeSearch = value =>
    String(value ?? "")
      .toLowerCase()
      .replace(/,/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  function formatBody(site) {
    return site.bodyType === "moon" ? `Moon ${site.body}` : `Planet ${site.body}`;
  }

  function getRigText(site) {
    if (site.rigs === null || site.rigs === undefined) {
      return "Rig count not yet recorded";
    }
    return site.rigs === 1 ? "1 mining rig" : `${site.rigs} mining rigs`;
  }

  function hasCoordinates(site) {
    return site.latitude !== null &&
      site.latitude !== undefined &&
      site.longitude !== null &&
      site.longitude !== undefined;
  }

  function addCopyButton(button, site) {
    if (!button || !hasCoordinates(site)) {
      button?.remove();
      return;
    }

    button.addEventListener("click", async () => {
      const coordinates = `${site.latitude} ${site.longitude}`;
      await navigator.clipboard.writeText(coordinates);
      button.textContent = "✓";
      setTimeout(() => {
        button.textContent = "⧉";
      }, 1500);
    });
  }

  function formatMarketAge(updatedValue) {
    if (!updatedValue) {
      return { text: "", stale: false };
    }

    const updated = new Date(updatedValue);
    if (Number.isNaN(updated.getTime())) {
      return { text: "", stale: false };
    }

    const ageMinutes = Math.max(0, Math.floor((Date.now() - updated.getTime()) / 60000));
    if (ageMinutes < 60) {
      return { text: `Updated ${ageMinutes}m ago`, stale: false };
    }
    if (ageMinutes < 1440) {
      return { text: `Updated ${Math.floor(ageMinutes / 60)}h ago`, stale: false };
    }

    const ageDays = Math.floor(ageMinutes / 1440);
    return {
      text: ageDays >= 7 ? `STALE — Updated ${ageDays}d ago` : `Updated ${ageDays}d ago`,
      stale: ageDays >= 7
    };
  }

  async function loadMiningData() {
    try {
      const response = await fetch("/api/mining", { cache: "no-store" });
      if (!response.ok) throw new Error("Same-origin mining API unavailable.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Mining API returned invalid data.");
      return data;
    } catch (apiError) {
      console.warn("Using mining.json fallback:", apiError);
      const response = await fetch(`data/mining.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load mining database.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Mining fallback returned invalid data.");
      return data;
    }
  }

  async function loadMarketData() {
    try {
      const response = await fetch(`data/market.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Market data unavailable.");
      return await response.json();
    } catch (error) {
      console.warn("Market data unavailable:", error);
      return { commodities: {}, markets: {} };
    }
  }

  Promise.all([loadMiningData(), loadMarketData()])
    .then(([miningData, marketData]) => {
      const commodityNames = [...new Set(miningData.map(site => site.commodity))]
        .sort((a, b) => a.localeCompare(b));

      const commodityCounts = miningData.reduce((counts, site) => {
        counts[site.commodity] = (counts[site.commodity] || 0) + 1;
        return counts;
      }, {});

      commodityFilter.innerHTML = '<option value="all">All Commodities</option>';
      commodityNames.forEach(commodity => {
        const option = document.createElement("option");
        option.value = commodity.toLowerCase();
        option.textContent = commodity;
        commodityFilter.appendChild(option);
      });

      function getMarketQuotes(commodity) {
        const marketName = marketNameMap[commodity] || commodity;
        const quotes = marketData.markets?.[marketName];

        if (Array.isArray(quotes)) {
          return quotes;
        }

        const legacy = marketData.commodities?.[marketName];
        return legacy ? [legacy] : [];
      }

      function getBestMarket(commodity, minimumDemand = 500) {
        return getMarketQuotes(commodity)
          .filter(quote => Number(quote.demand || 0) >= minimumDemand)
          .sort((a, b) => {
            const priceDifference = Number(b.price || 0) - Number(a.price || 0);
            if (priceDifference !== 0) return priceDifference;
            return Number(b.demand || 0) - Number(a.demand || 0);
          })[0] || null;
      }

      function createMarketBlock(commodity, minimumDemand, labelText) {
        const wrapper = document.createElement("div");
        wrapper.className = "mining-best-market";

        const label = document.createElement("p");
        label.className = "mining-best-market-label";
        label.textContent = labelText;
        wrapper.appendChild(label);

        const market = getBestMarket(commodity, minimumDemand);
        if (!market) {
          const unavailable = document.createElement("p");
          unavailable.className = "mining-best-market-empty";
          unavailable.textContent = `No market meets ${minimumDemand.toLocaleString()} demand`;
          wrapper.appendChild(unavailable);
          return wrapper;
        }

        const price = document.createElement("p");
        price.className = "mining-best-market-price";
        price.textContent = `${Number(market.price || 0).toLocaleString()} Cr`;
        wrapper.appendChild(price);

        const detail = document.createElement("p");
        detail.className = "mining-best-market-detail";
        detail.textContent = `${market.station || "Unknown station"} · Demand ${Number(market.demand || 0).toLocaleString()}`;
        wrapper.appendChild(detail);

        const age = formatMarketAge(market.marketUpdated);
        if (age.text) {
          const ageElement = document.createElement("p");
          ageElement.className = `mining-best-market-age${age.stale ? " stale" : ""}`;
          ageElement.textContent = age.text;
          wrapper.appendChild(ageElement);
        }

        return wrapper;
      }

      function renderCommodityIndex() {
        if (!commodityIndex) return;

        const minimumDemand = Number(marketDemandFilter?.value || 500);
        const sortMode = marketSort?.value || "price-desc";

        const items = commodityNames.map(commodity => {
          const sites = miningData.filter(site => site.commodity === commodity);
          return {
            commodity,
            sites,
            preferredSite: sites.find(site => site.preferred) || null,
            market: getBestMarket(commodity, minimumDemand)
          };
        });

        items.sort((a, b) => {
          const aMarket = a.market;
          const bMarket = b.market;

          if (!aMarket && bMarket) return 1;
          if (aMarket && !bMarket) return -1;

          if (sortMode === "price-asc") {
            return Number(aMarket?.price || 0) - Number(bMarket?.price || 0) ||
              a.commodity.localeCompare(b.commodity);
          }
          if (sortMode === "demand-desc") {
            return Number(bMarket?.demand || 0) - Number(aMarket?.demand || 0) ||
              Number(bMarket?.price || 0) - Number(aMarket?.price || 0);
          }
          if (sortMode === "commodity-asc") {
            return a.commodity.localeCompare(b.commodity);
          }

          return Number(bMarket?.price || 0) - Number(aMarket?.price || 0) ||
            a.commodity.localeCompare(b.commodity);
        });

        commodityIndex.innerHTML = "";

        items.forEach(item => {
          const card = document.createElement("div");
          card.className = "commodity-card";

          let preferredText = "Preferred site: Not yet verified";
          if (item.preferredSite) {
            preferredText = `Preferred site: ${formatBody(item.preferredSite)} — Signal #${item.preferredSite.signal}`;
          }

          card.innerHTML = `
            <h4></h4>
            <p>${item.sites.length} surveyed ${item.sites.length === 1 ? "location" : "locations"}</p>
            <p class="commodity-preferred"></p>
            <div class="commodity-market">
              <p class="commodity-market-label">BEST SELL IN 10-16 · MIN DEMAND ${minimumDemand.toLocaleString()}</p>
              <p class="commodity-market-price"></p>
              <p class="commodity-market-station"></p>
              <p class="commodity-market-demand"></p>
              <p class="commodity-market-age"></p>
            </div>
          `;

          card.querySelector("h4").textContent = item.commodity;
          card.querySelector(".commodity-preferred").textContent = preferredText;

          const priceElement = card.querySelector(".commodity-market-price");
          const stationElement = card.querySelector(".commodity-market-station");
          const demandElement = card.querySelector(".commodity-market-demand");
          const ageElement = card.querySelector(".commodity-market-age");

          if (item.market) {
            priceElement.textContent = `${Number(item.market.price || 0).toLocaleString()} Cr`;
            stationElement.textContent = item.market.station || "";
            demandElement.textContent = `Demand: ${Number(item.market.demand || 0).toLocaleString()}`;
            const age = formatMarketAge(item.market.marketUpdated);
            ageElement.textContent = age.text;
            if (age.stale) ageElement.classList.add("stale");
          } else {
            priceElement.textContent = "No qualifying market";
            stationElement.textContent = `Minimum demand: ${minimumDemand.toLocaleString()}`;
          }

          card.addEventListener("click", () => {
            commodityFilter.value = item.commodity.toLowerCase();
            commodityFilter.dispatchEvent(new Event("change"));
            resultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
          });

          commodityIndex.appendChild(card);
        });
      }

      function siteMatchesSearch(site, rawSearch) {
        let query = normalizeSearch(rawSearch);
        if (!query) return true;

        const rigMatch = query.match(/\b(\d+)\s+(?:mining\s+)?rigs?\b/);
        if (rigMatch) {
          if (Number(site.rigs) !== Number(rigMatch[1])) {
            return false;
          }
          query = normalizeSearch(query.replace(rigMatch[0], ""));
          if (!query) return true;
        }

        const coordinates = hasCoordinates(site)
          ? `${site.latitude} ${site.longitude}`
          : "";

        const haystack = normalizeSearch([
          site.commodity,
          formatBody(site),
          site.body,
          `#${site.signal}`,
          `signal #${site.signal}`,
          `${site.body} #${site.signal}`,
          `${site.body} signal #${site.signal}`,
          coordinates,
          getRigText(site),
          site.rigs !== null && site.rigs !== undefined ? `${site.rigs} rigs` : "",
          site.notes || ""
        ].join(" "));

        return query.split(" ").every(token => haystack.includes(token));
      }

      function sortSites(sites) {
        sites.sort((a, b) => {
          if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;

          const bodyComparison = String(a.body).localeCompare(String(b.body), undefined, {
            numeric: true,
            sensitivity: "base"
          });
          if (bodyComparison !== 0) return bodyComparison;

          const signalComparison = Number(a.signal) - Number(b.signal);
          if (signalComparison !== 0) return signalComparison;

          const rigsA = a.rigs ?? -1;
          const rigsB = b.rigs ?? -1;
          if (rigsA !== rigsB) return rigsB - rigsA;

          if (hasCoordinates(a) !== hasCoordinates(b)) return hasCoordinates(a) ? -1 : 1;
          return 0;
        });
      }

      function renderSites(sites, modeText) {
        resultsContainer.innerHTML = "";
        resultsStatus.textContent = modeText;

        if (sites.length === 0) {
          resultsContainer.innerHTML = '<div class="faction-loading">No mining locations match this search.</div>';
          return;
        }

        const commodities = [...new Set(sites.map(site => site.commodity))];

        if (commodities.length > 1) {
          sites.forEach(site => {
            const card = document.createElement("div");
            card.className = "location-card mining-site";
            const preferredLabel = site.preferred
              ? `${site.commodity.toUpperCase()} // PRIMARY`
              : site.commodity.toUpperCase();

            card.innerHTML = `
              <p class="location-type">${preferredLabel}</p>
              <h4></h4>
              <div class="mining-coordinate-line">
                <p class="mining-coordinates"></p>
                <button type="button" class="copy-coordinates-button" aria-label="Copy coordinates" title="Copy coordinates">⧉</button>
              </div>
              <p class="mining-rigs"></p>
              <p class="mining-site-count"></p>
            `;

            card.querySelector("h4").textContent = `${formatBody(site)} — Signal #${site.signal}`;
            card.querySelector(".mining-coordinates").textContent = hasCoordinates(site)
              ? `Coordinates: ${site.latitude}, ${site.longitude}`
              : "Coordinates: Not yet recorded";
            addCopyButton(card.querySelector(".copy-coordinates-button"), site);
            card.querySelector(".mining-rigs").textContent = site.notes
              ? `${getRigText(site)}. ${site.notes}`
              : getRigText(site);
            card.querySelector(".mining-site-count").textContent =
              `${commodityCounts[site.commodity] || 1} surveyed ${(commodityCounts[site.commodity] || 1) === 1 ? "location" : "locations"} for ${site.commodity}`;

            if (site.preferred) {
              card.appendChild(createMarketBlock(site.commodity, 500, "BEST SELL · 500+ DEMAND"));
            }

            resultsContainer.appendChild(card);
          });
          return;
        }

        const commodity = commodities[0];
        const commodityHeading = document.createElement("div");
        commodityHeading.className = "mining-group-commodity";
        commodityHeading.textContent = commodity.toUpperCase();
        resultsContainer.appendChild(commodityHeading);

        const bodyGroups = {};
        sites.forEach(site => {
          const bodyKey = `${site.bodyType}:${site.body}`;
          (bodyGroups[bodyKey] ||= []).push(site);
        });

        Object.values(bodyGroups).forEach(bodySites => {
          const bodyGroup = document.createElement("section");
          bodyGroup.className = "mining-body-group";

          const bodyHeading = document.createElement("h3");
          bodyHeading.className = "mining-body-heading";
          bodyHeading.textContent = formatBody(bodySites[0]);
          bodyGroup.appendChild(bodyHeading);

          const signalGroups = {};
          bodySites.forEach(site => {
            (signalGroups[String(site.signal)] ||= []).push(site);
          });

          Object.entries(signalGroups).forEach(([signal, signalSites]) => {
            const signalGroup = document.createElement("div");
            signalGroup.className = "mining-signal-group";

            const signalHeading = document.createElement("h4");
            signalHeading.className = "mining-signal-heading";
            signalHeading.textContent = `Signal #${signal} · ${signalSites.length} ${signalSites.length === 1 ? "location" : "locations"}`;
            signalGroup.appendChild(signalHeading);

            signalSites.forEach(site => {
              const location = document.createElement("div");
              location.className = `mining-location-row${site.preferred ? " primary" : ""}`;
              const coordinatesText = hasCoordinates(site)
                ? `${site.latitude}, ${site.longitude}`
                : "Not yet recorded";

              location.innerHTML = `
                <p class="mining-location-rigs"></p>
                <div class="mining-coordinate-line">
                  <p class="mining-location-coordinates"></p>
                  <button type="button" class="copy-coordinates-button" aria-label="Copy coordinates" title="Copy coordinates">⧉</button>
                </div>
                <p class="mining-location-notes"></p>
              `;

              location.querySelector(".mining-location-rigs").textContent =
                `${site.preferred ? "PRIMARY SITE // " : ""}${getRigText(site)}`;
              location.querySelector(".mining-location-coordinates").textContent = `Coordinates: ${coordinatesText}`;
              addCopyButton(location.querySelector(".copy-coordinates-button"), site);

              const notesElement = location.querySelector(".mining-location-notes");
              if (site.notes) notesElement.textContent = site.notes;
              else notesElement.remove();

              if (site.preferred) {
                location.appendChild(createMarketBlock(site.commodity, 500, "BEST SELL · 500+ DEMAND"));
              }

              signalGroup.appendChild(location);
            });

            bodyGroup.appendChild(signalGroup);
          });

          resultsContainer.appendChild(bodyGroup);
        });
      }

      function applyMiningFilters() {
        const selectedCommodity = commodityFilter.value.trim().toLowerCase();
        const searchText = searchBox.value.trim();
        const hasCommodityFilter = selectedCommodity !== "all";
        const hasSearch = searchText !== "";

        if (!hasCommodityFilter && !hasSearch) {
          const preferredSites = miningData.filter(site => site.preferred);
          sortSites(preferredSites);
          renderSites(preferredSites, "Showing preferred mining sites · market price uses 500+ demand");
          return;
        }

        const filteredSites = miningData.filter(site => {
          const matchesCommodity = !hasCommodityFilter || site.commodity.toLowerCase() === selectedCommodity;
          return matchesCommodity && siteMatchesSearch(site, searchText);
        });

        sortSites(filteredSites);

        let modeText = `Showing ${filteredSites.length} mining ${filteredSites.length === 1 ? "location" : "locations"}`;
        if (hasCommodityFilter) {
          modeText += ` for ${commodityFilter.options[commodityFilter.selectedIndex].text}`;
        }

        renderSites(filteredSites, modeText);
      }

      commodityFilter.addEventListener("change", applyMiningFilters);
      searchBox.addEventListener("input", applyMiningFilters);
      marketDemandFilter?.addEventListener("change", renderCommodityIndex);
      marketSort?.addEventListener("change", renderCommodityIndex);

      renderCommodityIndex();
      applyMiningFilters();
    })
    .catch(error => {
      console.error("Mining database error:", error);
      resultsStatus.textContent = "Mining database unavailable";
      resultsContainer.innerHTML = '<div class="faction-loading">Unable to load mining locations.</div>';
    });
})();
