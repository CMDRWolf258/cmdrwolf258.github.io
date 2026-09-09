async function loadSystemData() {
  try {

    const response = await fetch(
      "data/system.json?ts=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Unable to load system data");
    }

    const data = await response.json();

const dataAgeElement =
  document.getElementById("system-data-age");

if (dataAgeElement && data.lastUpdated) {

  const updated =
    new Date(data.lastUpdated);

  const ageMilliseconds =
    Date.now() - updated.getTime();

  const ageMinutes =
    Math.floor(ageMilliseconds / 60000);

  let ageText;

  if (ageMinutes < 1) {
    ageText = "Just refreshed";
  } else if (ageMinutes < 60) {
    ageText = `${ageMinutes} min ago`;
  } else {
    const hours =
      Math.floor(ageMinutes / 60);

    const remainingMinutes =
      ageMinutes % 60;

    ageText =
      `${hours}h ${remainingMinutes}m ago`;
  }

  dataAgeElement.textContent =
    ageText;
}
    
    // -------------------------
    // POPULATION
    // -------------------------

    const populationElements =
      document.querySelectorAll(".live-population");

    populationElements.forEach(element => {

      const population = Number(data.population);

      element.textContent =
        (population / 1000000000).toFixed(2) + " Billion";

      element.title =
        population.toLocaleString() + " inhabitants";

    });

const controllingFactionElements =
  document.querySelectorAll(".live-controlling-faction");

controllingFactionElements.forEach(element => {
  element.textContent =
    data.controllingFaction || "Unknown";
});
    

    // -------------------------
    // FACTIONS
    // -------------------------

    const factionGrid =
      document.getElementById("faction-grid");

    if (factionGrid) {

      if (
        Array.isArray(data.factions) &&
        data.factions.length > 0
      ) {

        factionGrid.innerHTML = "";

        data.factions.forEach(faction => {

          const card =
            document.createElement("div");

          card.className =
            "faction-card" +
            (faction.controlling ? " controlling" : "");

          const role =
            faction.controlling
              ? "CONTROLLING FACTION"
              : "SYSTEM FACTION";

          let influence = "Unknown";

          if (
            faction.influence !== null &&
            faction.influence !== undefined
          ) {

            let value =
              Number(faction.influence);

            if (value <= 1) {
              value *= 100;
            }

            influence =
              value.toFixed(1) + "%";
          }

          card.innerHTML = `
            <p class="faction-role">${role}</p>

            <h4></h4>

            <div class="faction-details">

              <div class="faction-detail">
                <span class="faction-detail-label">
                  Influence
                </span>

                <span class="faction-detail-value">
                  ${influence}
                </span>
              </div>

              <div class="faction-detail">
                <span class="faction-detail-label">
                  State
                </span>

                <span class="faction-detail-value faction-state">
                </span>
              </div>

              <div class="faction-detail">
                <span class="faction-detail-label">
                  Government
                </span>

                <span class="faction-detail-value faction-government">
                </span>
              </div>

              <div class="faction-detail">
                <span class="faction-detail-label">
                  Allegiance
                </span>

                <span class="faction-detail-value faction-allegiance">
                </span>
              </div>

            </div>
          `;

          card.querySelector("h4").textContent =
            faction.name;

          card.querySelector(".faction-state").textContent =
            faction.state || "None";

          card.querySelector(".faction-government").textContent =
            faction.government || "Unknown";

          card.querySelector(".faction-allegiance").textContent =
            faction.allegiance || "Independent";

          factionGrid.appendChild(card);

        });

      } else {

        factionGrid.innerHTML =
          '<div class="faction-loading">Faction data currently unavailable.</div>';

      }

    }

  } catch (error) {

    console.error("System data error:", error);

    const populationElements =
      document.querySelectorAll(".live-population");

    populationElements.forEach(element => {
      element.textContent = "Data unavailable";
    });

    const factionGrid =
      document.getElementById("faction-grid");

    if (factionGrid) {
      factionGrid.innerHTML =
        '<div class="faction-loading">Faction data currently unavailable.</div>';
    }

  }
}

loadSystemData();

async function loadDailyOrders() {

  const issueNumber = 1;

  const ordersList =
    document.getElementById("daily-orders-list");

  const updatedElement =
    document.getElementById("orders-updated");

  if (!ordersList) {
    return;
  }

  try {

    const response = await fetch(
      `https://api.github.com/repos/cmdrwolf258/cmdrwolf258.github.io/issues/${issueNumber}`
    );

    if (!response.ok) {
      throw new Error("Unable to load BGS orders");
    }

    const issue = await response.json();

    const orders = issue.body
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line =>
        line.replace(/^[-*•]\s*/, "")
      );

    ordersList.innerHTML = "";

    orders.forEach(order => {

      const item =
        document.createElement("li");

      item.textContent = order;

      ordersList.appendChild(item);

    });

    const updated =
      new Date(issue.updated_at);

    updatedElement.textContent =
      updated.toLocaleString(
        undefined,
        {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }
      );

  } catch (error) {

    console.error(
      "Daily orders error:",
      error
    );

    ordersList.innerHTML =
      "<li>Current orders unavailable.</li>";

    if (updatedElement) {
      updatedElement.textContent =
        "Unavailable";
    }

  }

}

loadDailyOrders();

async function setupMiningDatabase() {

  const searchBox =
    document.getElementById("mining-search");

  const commodityFilter =
    document.getElementById("commodity-filter");

  const resultsContainer =
    document.getElementById("mining-results");

  const resultsStatus =
    document.getElementById("mining-results-status");

  if (
    !searchBox ||
    !commodityFilter ||
    !resultsContainer ||
    !resultsStatus
  ) {
    return;
  }

  try {

    const response = await fetch(
      "data/mining.json?ts=" + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error("Unable to load mining database");
    }

    const miningData =
      await response.json();

    const marketResponse = await fetch(
  "data/market.json?ts=" + Date.now(),
  { cache: "no-store" }
);

let marketData = {
  commodities: {}
};

if (marketResponse.ok) {
  marketData =
    await marketResponse.json();
}

    const commodityNames = [
  ...new Set(
    miningData.map(site => site.commodity)
  )
].sort((a, b) =>
  a.localeCompare(b)
);

commodityFilter.innerHTML =
  '<option value="all">All Commodities</option>';

commodityNames.forEach(commodity => {

  const option =
    document.createElement("option");

  option.value =
    commodity.toLowerCase();

  option.textContent =
    commodity;

  commodityFilter.appendChild(option);

});
    const commodityIndex =
  document.getElementById("commodity-index");

if (commodityIndex) {

  commodityIndex.innerHTML = "";

  commodityNames.forEach(commodity => {

    const commoditySites =
      miningData.filter(
        site => site.commodity === commodity
      );

    const preferredSite =
      commoditySites.find(
        site => site.preferred
      );

    const card =
      document.createElement("div");

    card.className =
      "commodity-card";

    let preferredText =
      "Preferred site: Not yet verified";

    if (preferredSite) {

      const bodyLabel =
        preferredSite.bodyType === "moon"
          ? `Moon ${preferredSite.body}`
          : `Planet ${preferredSite.body}`;

      preferredText =
        `Preferred site: ${bodyLabel} — Signal #${preferredSite.signal}`;

    }

    const locationCount =
      commoditySites.length;

const marketNameMap = {
  "Diamonds": "Diamond",
  "LTD": "Low Temperature Diamonds"
};

const marketCommodityName =
  marketNameMap[commodity] || commodity;

const marketInfo =
  marketData.commodities?.[marketCommodityName];

let marketPriceText =
  "Market data unavailable";

let marketStationText = "";

let marketDemandText = "";

let marketAgeText = "";

if (marketInfo) {

  marketPriceText =
    `${Number(marketInfo.price).toLocaleString()} Cr`;

  marketStationText =
    marketInfo.station || "";

  if (
    marketInfo.demand !== null &&
    marketInfo.demand !== undefined
  ) {
    marketDemandText =
      `Demand: ${Number(marketInfo.demand).toLocaleString()}`;
  }

  if (marketInfo.marketUpdated) {

  const marketUpdated =
    new Date(marketInfo.marketUpdated);

  const ageMilliseconds =
    Date.now() - marketUpdated.getTime();

  const ageMinutes =
    Math.floor(ageMilliseconds / 60000);

  if (ageMinutes < 60) {
    marketAgeText =
      `Updated ${ageMinutes}m ago`;
  } else if (ageMinutes < 1440) {
    marketAgeText =
      `Updated ${Math.floor(ageMinutes / 60)}h ago`;
  } else {
    marketAgeText =
      `Updated ${Math.floor(ageMinutes / 1440)}d ago`;
  }

}

}

card.innerHTML = `
  <h4></h4>

  <p>
    ${locationCount} surveyed ${
      locationCount === 1
        ? "location"
        : "locations"
    }
  </p>

  <p class="commodity-preferred"></p>

  <div class="commodity-market">
    <p class="commodity-market-label">
      BEST SELL IN 10-16
    </p>

    <p class="commodity-market-price"></p>

    <p class="commodity-market-station"></p>

    <p class="commodity-market-demand"></p>
    <p class="commodity-market-age"></p>
  </div>
`;

    card.querySelector("h4").textContent =
      commodity;

    card.querySelector(".commodity-preferred").textContent =
      preferredText;

    card.querySelector(".commodity-market-price").textContent =
  marketPriceText;

card.querySelector(".commodity-market-station").textContent =
  marketStationText;

card.querySelector(".commodity-market-demand").textContent =
  marketDemandText;
    
card.querySelector(".commodity-market-age").textContent =
  marketAgeText;

if (
  marketInfo?.marketUpdated &&
  Date.now() - new Date(marketInfo.marketUpdated).getTime()
    >= 7 * 24 * 60 * 60 * 1000
) {
  card
    .querySelector(".commodity-market-age")
    .classList.add("stale");
}
    
card.addEventListener("click", () => {

  commodityFilter.value =
    commodity.toLowerCase();

  commodityFilter.dispatchEvent(
    new Event("change")
  );

  document
    .getElementById("mining-results")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

});
    commodityIndex.appendChild(card);

  });

}

    function formatBody(site) {

      if (site.bodyType === "moon") {
        return `Moon ${site.body}`;
      }

      return `Planet ${site.body}`;

    }

    function getCommodityCounts() {

      const counts = {};

      miningData.forEach(site => {

        const commodity =
          site.commodity;

        counts[commodity] =
          (counts[commodity] || 0) + 1;

      });

      return counts;

    }

    const commodityCounts =
      getCommodityCounts();

    function renderSites(sites, modeText) {

      resultsContainer.innerHTML = "";

      resultsStatus.textContent =
        modeText;

      if (sites.length === 0) {

        resultsContainer.innerHTML = `
          <div class="faction-loading">
            No mining locations match this search.
          </div>
        `;

        return;
      }

      sites.forEach(site => {

        const card =
          document.createElement("div");

        card.className =
          "location-card mining-site";

        const commodityCount =
          commodityCounts[site.commodity] || 1;

        const preferredLabel =
          site.preferred
            ? `${site.commodity.toUpperCase()} // PRIMARY`
            : site.commodity.toUpperCase();

        let rigText;

if (
  site.rigs === null ||
  site.rigs === undefined
) {
  rigText = "Rig count not yet recorded";
} else if (site.rigs === 1) {
  rigText = "1 mining rig";
} else {
  rigText = `${site.rigs} mining rigs`;
}

        card.innerHTML = `
          <p class="location-type">
            ${preferredLabel}
          </p>

          <h4></h4>

          <p class="mining-coordinates"></p>

          <p class="mining-rigs"></p>

          <p class="mining-site-count"></p>
        `;

        card.querySelector("h4").textContent =
          `${formatBody(site)} — Signal #${site.signal}`;

       if (
  site.latitude !== null &&
  site.latitude !== undefined &&
  site.longitude !== null &&
  site.longitude !== undefined
) {
  card.querySelector(".mining-coordinates").textContent =
    `Coordinates: ${site.latitude}, ${site.longitude}`;
} else {
  card.querySelector(".mining-coordinates").textContent =
    "Coordinates: Not yet recorded";
}

        card.querySelector(".mining-rigs").textContent =
          site.notes
            ? `${rigText}. ${site.notes}`
            : rigText;

        card.querySelector(".mining-site-count").textContent =
          `${commodityCount} surveyed ${
            commodityCount === 1
              ? "location"
              : "locations"
          } for ${site.commodity}`;

        resultsContainer.appendChild(card);

      });

    }

    function applyMiningFilters() {

      const selectedCommodity =
        commodityFilter.value
          .trim()
          .toLowerCase();

      const searchText =
        searchBox.value
          .trim()
          .toLowerCase();

      const hasCommodityFilter =
        selectedCommodity !== "all";

      const hasSearch =
        searchText !== "";

      if (
        !hasCommodityFilter &&
        !hasSearch
      ) {

        const preferredSites =
          miningData.filter(
            site => site.preferred
          );

        renderSites(
          preferredSites,
          "Showing preferred mining sites"
        );

        return;
      }

      const filteredSites =
        miningData.filter(site => {

          const commodity =
            site.commodity.toLowerCase();

          const bodyLabel =
            formatBody(site).toLowerCase();

          const signalText =
            `signal #${site.signal}`;

          const coordinateText =
            `${site.latitude}, ${site.longitude}`;

          const notes =
            (site.notes || "").toLowerCase();

          const matchesCommodity =
            !hasCommodityFilter ||
            commodity === selectedCommodity;

          const matchesSearch =
            !hasSearch ||
            commodity.includes(searchText) ||
            bodyLabel.includes(searchText) ||
            signalText.includes(searchText) ||
            coordinateText.includes(searchText) ||
            notes.includes(searchText);

          return (
            matchesCommodity &&
            matchesSearch
          );

        });

      let modeText =
        `Showing ${filteredSites.length} mining ${
          filteredSites.length === 1
            ? "location"
            : "locations"
        }`;

      if (hasCommodityFilter) {

        const selectedLabel =
          commodityFilter.options[
            commodityFilter.selectedIndex
          ].text;

        modeText +=
          ` for ${selectedLabel}`;

      }

      renderSites(
        filteredSites,
        modeText
      );

    }

    commodityFilter.addEventListener(
      "change",
      applyMiningFilters
    );

    searchBox.addEventListener(
      "input",
      applyMiningFilters
    );

    applyMiningFilters();

  } catch (error) {

    console.error(
      "Mining database error:",
      error
    );

    resultsStatus.textContent =
      "Mining database unavailable";

    resultsContainer.innerHTML = `
      <div class="faction-loading">
        Unable to load mining locations.
      </div>
    `;

  }

}

setupMiningDatabase();
