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
      document.querySelectorAll(
        ".live-population"
      );

    populationElements.forEach(
      element => {
        const population =
          Number(data.population);

        element.textContent =
          (population / 1000000000)
            .toFixed(2) +
          " Billion";

        element.title =
          population.toLocaleString() +
          " inhabitants";
      }
    );

    // -------------------------
    // CONTROLLING FACTION
    // -------------------------

    const controllingFactionElements =
      document.querySelectorAll(
        ".live-controlling-faction"
      );

    controllingFactionElements.forEach(
      element => {
        element.textContent =
          data.controllingFaction ||
          "Unknown";
      }
    );

    // -------------------------
    // FACTIONS
    // -------------------------

    const factionGrid =
      document.getElementById(
        "faction-grid"
      );

    if (factionGrid) {
      if (
        Array.isArray(data.factions) &&
        data.factions.length > 0
      ) {
        factionGrid.innerHTML = "";

        data.factions.forEach(
          faction => {
            const card =
              document.createElement(
                "div"
              );

            card.className =
              "faction-card" +
              (
                faction.controlling
                  ? " controlling"
                  : ""
              );

            const role =
              faction.controlling
                ? "CONTROLLING FACTION"
                : "SYSTEM FACTION";

            let influence =
              "Unknown";

            if (
              faction.influence !== null &&
              faction.influence !== undefined
            ) {
              let value =
                Number(
                  faction.influence
                );

              if (value <= 1) {
                value *= 100;
              }

              influence =
                value.toFixed(1) + "%";
            }

            card.innerHTML = `
              <p class="faction-role">
                ${role}
              </p>

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
                  <span class="faction-detail-value faction-state"></span>
                </div>

                <div class="faction-detail">
                  <span class="faction-detail-label">
                    Government
                  </span>
                  <span class="faction-detail-value faction-government"></span>
                </div>

                <div class="faction-detail">
                  <span class="faction-detail-label">
                    Allegiance
                  </span>
                  <span class="faction-detail-value faction-allegiance"></span>
                </div>
              </div>
            `;

            card.querySelector(
              "h4"
            ).textContent =
              faction.name;

            card.querySelector(
              ".faction-state"
            ).textContent =
              faction.state || "None";

            card.querySelector(
              ".faction-government"
            ).textContent =
              faction.government ||
              "Unknown";

            card.querySelector(
              ".faction-allegiance"
            ).textContent =
              faction.allegiance ||
              "Independent";

            factionGrid.appendChild(
              card
            );
          }
        );
      } else {
        factionGrid.innerHTML =
          '<div class="faction-loading">Faction data currently unavailable.</div>';
      }
    }
  } catch (error) {
    console.error(
      "System data error:",
      error
    );

    const populationElements =
      document.querySelectorAll(
        ".live-population"
      );

    populationElements.forEach(
      element => {
        element.textContent =
          "Data unavailable";
      }
    );

    const factionGrid =
      document.getElementById(
        "faction-grid"
      );

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
    document.getElementById(
      "daily-orders-list"
    );

  const updatedElement =
    document.getElementById(
      "orders-updated"
    );

  if (!ordersList) {
    return;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/cmdrwolf258/cmdrwolf258.github.io/issues/${issueNumber}`
    );

    if (!response.ok) {
      throw new Error(
        "Unable to load BGS orders"
      );
    }

    const issue =
      await response.json();

    const orders = issue.body
      .split(/\r?\n/)
      .map(
        line => line.trim()
      )
      .filter(
        line => line.length > 0
      )
      .map(
        line =>
          line.replace(
            /^[-*•]\s*/,
            ""
          )
      );

    ordersList.innerHTML = "";

    orders.forEach(
      order => {
        const item =
          document.createElement(
            "li"
          );

        item.textContent =
          order;

        ordersList.appendChild(
          item
        );
      }
    );

    if (updatedElement) {
      const updated =
        new Date(
          issue.updated_at
        );

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
    }
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
    document.getElementById(
      "mining-search"
    );

  const commodityFilter =
    document.getElementById(
      "commodity-filter"
    );

  const resultsContainer =
    document.getElementById(
      "mining-results"
    );

  const resultsStatus =
    document.getElementById(
      "mining-results-status"
    );

  if (
    !searchBox ||
    !commodityFilter ||
    !resultsContainer ||
    !resultsStatus
  ) {
    return;
  }

  try {
    // -------------------------
    // MINING DATA
    // Cloudflare D1 is primary.
    // mining.json remains fallback.
    // -------------------------

    let miningData;

    try {
      const apiResponse =
        await fetch(
          "https://ten16-api.michael-schroll.workers.dev/api/mining",
          {
            cache: "no-store"
          }
        );

      if (!apiResponse.ok) {
        throw new Error(
          "Cloudflare mining API unavailable."
        );
      }

      miningData =
        await apiResponse.json();

      if (
        !Array.isArray(
          miningData
        )
      ) {
        throw new Error(
          "Cloudflare mining API returned invalid data."
        );
      }
    } catch (apiError) {
      console.warn(
        "Using mining.json fallback:",
        apiError
      );

      const fallbackResponse =
        await fetch(
          "data/mining.json?ts=" +
            Date.now(),
          {
            cache: "no-store"
          }
        );

      if (!fallbackResponse.ok) {
        throw new Error(
          "Unable to load mining database"
        );
      }

      miningData =
        await fallbackResponse.json();

      if (
        !Array.isArray(
          miningData
        )
      ) {
        throw new Error(
          "Mining fallback returned invalid data."
        );
      }
    }

    // -------------------------
    // MARKET DATA
    // -------------------------

    let marketData = {
      commodities: {}
    };

    try {
      const marketResponse =
        await fetch(
          "data/market.json?ts=" +
            Date.now(),
          {
            cache: "no-store"
          }
        );

      if (marketResponse.ok) {
        marketData =
          await marketResponse.json();
      }
    } catch (marketError) {
      console.warn(
        "Market data unavailable:",
        marketError
      );
    }

    // -------------------------
    // COMMODITY FILTER
    // -------------------------

    const commodityNames = [
      ...new Set(
        miningData.map(
          site =>
            site.commodity
        )
      )
    ].sort(
      (a, b) =>
        a.localeCompare(b)
    );

    commodityFilter.innerHTML =
      '<option value="all">All Commodities</option>';

    commodityNames.forEach(
      commodity => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          commodity.toLowerCase();

        option.textContent =
          commodity;

        commodityFilter.appendChild(
          option
        );
      }
    );

    // -------------------------
    // HELPERS
    // -------------------------

    function formatBody(site) {
      if (
        site.bodyType ===
        "moon"
      ) {
        return `Moon ${site.body}`;
      }

      return `Planet ${site.body}`;
    }

    function getCommodityCounts() {
      const counts = {};

      miningData.forEach(
        site => {
          const commodity =
            site.commodity;

          counts[commodity] =
            (
              counts[commodity] ||
              0
            ) + 1;
        }
      );

      return counts;
    }

    function getRigText(site) {
      if (
        site.rigs === null ||
        site.rigs === undefined
      ) {
        return (
          "Rig count not yet recorded"
        );
      }

      if (site.rigs === 1) {
        return "1 mining rig";
      }

      return (
        `${site.rigs} mining rigs`
      );
    }

    function hasCoordinates(site) {
      return (
        site.latitude !== null &&
        site.latitude !==
          undefined &&
        site.longitude !== null &&
        site.longitude !==
          undefined
      );
    }

    function addCopyButton(
      button,
      site
    ) {
      if (
        !hasCoordinates(site)
      ) {
        button.remove();
        return;
      }

      button.addEventListener(
        "click",
        async () => {
          const coordinates =
            `${site.latitude} ${site.longitude}`;

          await navigator.clipboard
            .writeText(
              coordinates
            );

          button.textContent =
            "✓";

          setTimeout(
            () => {
              button.textContent =
                "⧉";
            },
            1500
          );
        }
      );
    }

    const commodityCounts =
      getCommodityCounts();

    // -------------------------
    // COMMODITY INDEX
    // -------------------------

    const commodityIndex =
      document.getElementById(
        "commodity-index"
      );

    if (commodityIndex) {
      commodityIndex.innerHTML =
        "";

      const marketNameMap = {
        Diamonds: "Diamond",
        LTD:
          "Low Temperature Diamonds"
      };

      commodityNames.forEach(
        commodity => {
          const commoditySites =
            miningData.filter(
              site =>
                site.commodity ===
                commodity
            );

          const preferredSite =
            commoditySites.find(
              site =>
                site.preferred
            );

          const card =
            document.createElement(
              "div"
            );

          card.className =
            "commodity-card";

          let preferredText =
            "Preferred site: Not yet verified";

          if (preferredSite) {
            const bodyLabel =
              formatBody(
                preferredSite
              );

            preferredText =
              `Preferred site: ${bodyLabel} — Signal #${preferredSite.signal}`;
          }

          const locationCount =
            commoditySites.length;

          const marketCommodityName =
            marketNameMap[
              commodity
            ] || commodity;

          const marketInfo =
            marketData
              .commodities?.[
                marketCommodityName
              ];

          let marketPriceText =
            "Market data unavailable";

          let marketStationText =
            "";

          let marketDemandText =
            "";

          let marketAgeText =
            "";

          if (marketInfo) {
            marketPriceText =
              `${Number(
                marketInfo.price
              ).toLocaleString()} Cr`;

            marketStationText =
              marketInfo.station ||
              "";

            if (
              marketInfo.demand !==
                null &&
              marketInfo.demand !==
                undefined
            ) {
              marketDemandText =
                `Demand: ${Number(
                  marketInfo.demand
                ).toLocaleString()}`;
            }

            if (
              marketInfo
                .marketUpdated
            ) {
              const marketUpdated =
                new Date(
                  marketInfo
                    .marketUpdated
                );

              const ageMilliseconds =
                Date.now() -
                marketUpdated
                  .getTime();

              const ageMinutes =
                Math.floor(
                  ageMilliseconds /
                    60000
                );

              if (
                ageMinutes < 60
              ) {
                marketAgeText =
                  `Updated ${ageMinutes}m ago`;
              } else if (
                ageMinutes < 1440
              ) {
                marketAgeText =
                  `Updated ${Math.floor(
                    ageMinutes / 60
                  )}h ago`;
              } else {
                const ageDays =
                  Math.floor(
                    ageMinutes /
                      1440
                  );

                marketAgeText =
                  ageDays >= 7
                    ? `STALE — Updated ${ageDays}d ago`
                    : `Updated ${ageDays}d ago`;
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

          card.querySelector(
            "h4"
          ).textContent =
            commodity;

          card.querySelector(
            ".commodity-preferred"
          ).textContent =
            preferredText;

          card.querySelector(
            ".commodity-market-price"
          ).textContent =
            marketPriceText;

          card.querySelector(
            ".commodity-market-station"
          ).textContent =
            marketStationText;

          card.querySelector(
            ".commodity-market-demand"
          ).textContent =
            marketDemandText;

          const marketAgeElement =
            card.querySelector(
              ".commodity-market-age"
            );

          marketAgeElement
            .textContent =
            marketAgeText;

          if (
            marketInfo?.marketUpdated &&
            Date.now() -
              new Date(
                marketInfo
                  .marketUpdated
              ).getTime() >=
              7 *
                24 *
                60 *
                60 *
                1000
          ) {
            marketAgeElement
              .classList.add(
                "stale"
              );
          }

          card.addEventListener(
            "click",
            () => {
              commodityFilter.value =
                commodity
                  .toLowerCase();

              commodityFilter
                .dispatchEvent(
                  new Event(
                    "change"
                  )
                );

              document
                .getElementById(
                  "mining-results"
                )
                .scrollIntoView({
                  behavior:
                    "smooth",
                  block: "start"
                });
            }
          );

          commodityIndex
            .appendChild(
              card
            );
        }
      );
    }

    // -------------------------
    // MINING RESULTS RENDERER
    // -------------------------

    function renderSites(
      sites,
      modeText
    ) {
      resultsContainer.innerHTML =
        "";

      resultsStatus.textContent =
        modeText;

      if (
        sites.length === 0
      ) {
        resultsContainer.innerHTML = `
          <div class="faction-loading">
            No mining locations match this search.
          </div>
        `;

        return;
      }

      const commodities = [
        ...new Set(
          sites.map(
            site =>
              site.commodity
          )
        )
      ];

      // If several commodities are shown,
      // keep the compact card-style display.
      if (
        commodities.length > 1
      ) {
        sites.forEach(
          site => {
            const card =
              document.createElement(
                "div"
              );

            card.className =
              "location-card mining-site";

            const commodityCount =
              commodityCounts[
                site.commodity
              ] || 1;

            const preferredLabel =
              site.preferred
                ? `${site.commodity.toUpperCase()} // PRIMARY`
                : site.commodity.toUpperCase();

            const rigText =
              getRigText(site);

            card.innerHTML = `
              <p class="location-type">
                ${preferredLabel}
              </p>

              <h4></h4>

              <div class="mining-coordinate-line">
                <p class="mining-coordinates"></p>

                <button
                  type="button"
                  class="copy-coordinates-button"
                  aria-label="Copy coordinates"
                  title="Copy coordinates"
                >
                  ⧉
                </button>
              </div>

              <p class="mining-rigs"></p>
              <p class="mining-site-count"></p>
            `;

            card.querySelector(
              "h4"
            ).textContent =
              `${formatBody(site)} — Signal #${site.signal}`;

            card.querySelector(
              ".mining-coordinates"
            ).textContent =
              hasCoordinates(site)
                ? `Coordinates: ${site.latitude}, ${site.longitude}`
                : "Coordinates: Not yet recorded";

            const copyButton =
              card.querySelector(
                ".copy-coordinates-button"
              );

            addCopyButton(
              copyButton,
              site
            );

            card.querySelector(
              ".mining-rigs"
            ).textContent =
              site.notes
                ? `${rigText}. ${site.notes}`
                : rigText;

            card.querySelector(
              ".mining-site-count"
            ).textContent =
              `${commodityCount} surveyed ${
                commodityCount === 1
                  ? "location"
                  : "locations"
              } for ${site.commodity}`;

            resultsContainer
              .appendChild(
                card
              );
          }
        );

        return;
      }

      // One commodity selected:
      // group by body, then signal.
      const commodity =
        commodities[0];

      const commodityHeading =
        document.createElement(
          "div"
        );

      commodityHeading.className =
        "mining-group-commodity";

      commodityHeading.textContent =
        commodity.toUpperCase();

      resultsContainer.appendChild(
        commodityHeading
      );

      const bodyGroups = {};

      sites.forEach(
        site => {
          const bodyKey =
            `${site.bodyType}:${site.body}`;

          if (
            !bodyGroups[
              bodyKey
            ]
          ) {
            bodyGroups[
              bodyKey
            ] = [];
          }

          bodyGroups[
            bodyKey
          ].push(site);
        }
      );

      Object.values(
        bodyGroups
      ).forEach(
        bodySites => {
          const bodyGroup =
            document.createElement(
              "section"
            );

          bodyGroup.className =
            "mining-body-group";

          const bodyHeading =
            document.createElement(
              "h3"
            );

          bodyHeading.className =
            "mining-body-heading";

          bodyHeading.textContent =
            formatBody(
              bodySites[0]
            );

          bodyGroup.appendChild(
            bodyHeading
          );

          const signalGroups =
            {};

          bodySites.forEach(
            site => {
              const signalKey =
                String(
                  site.signal
                );

              if (
                !signalGroups[
                  signalKey
                ]
              ) {
                signalGroups[
                  signalKey
                ] = [];
              }

              signalGroups[
                signalKey
              ].push(site);
            }
          );

          Object.entries(
            signalGroups
          ).forEach(
            (
              [
                signal,
                signalSites
              ]
            ) => {
              const signalGroup =
                document.createElement(
                  "div"
                );

              signalGroup.className =
                "mining-signal-group";

              const signalHeading =
                document.createElement(
                  "h4"
                );

              signalHeading.className =
                "mining-signal-heading";

              signalHeading.textContent =
                `Signal #${signal} · ${signalSites.length} ${
                  signalSites.length ===
                  1
                    ? "location"
                    : "locations"
                }`;

              signalGroup
                .appendChild(
                  signalHeading
                );

              signalSites.forEach(
                site => {
                  const location =
                    document.createElement(
                      "div"
                    );

                  location.className =
                    "mining-location-row";

                  if (
                    site.preferred
                  ) {
                    location
                      .classList.add(
                        "primary"
                      );
                  }

                  const rigText =
                    getRigText(site);

                  const primaryText =
                    site.preferred
                      ? "PRIMARY SITE // "
                      : "";

                  const coordinatesText =
                    hasCoordinates(
                      site
                    )
                      ? `${site.latitude}, ${site.longitude}`
                      : "Not yet recorded";

                  location.innerHTML = `
                    <p class="mining-location-rigs"></p>

                    <div class="mining-coordinate-line">
                      <p class="mining-location-coordinates"></p>

                      <button
                        type="button"
                        class="copy-coordinates-button"
                        aria-label="Copy coordinates"
                        title="Copy coordinates"
                      >
                        ⧉
                      </button>
                    </div>

                    <p class="mining-location-notes"></p>
                  `;

                  location
                    .querySelector(
                      ".mining-location-rigs"
                    )
                    .textContent =
                      `${primaryText}${rigText}`;

                  location
                    .querySelector(
                      ".mining-location-coordinates"
                    )
                    .textContent =
                      `Coordinates: ${coordinatesText}`;

                  const copyButton =
                    location
                      .querySelector(
                        ".copy-coordinates-button"
                      );

                  addCopyButton(
                    copyButton,
                    site
                  );

                  const notesElement =
                    location
                      .querySelector(
                        ".mining-location-notes"
                      );

                  if (
                    site.notes
                  ) {
                    notesElement
                      .textContent =
                      site.notes;
                  } else {
                    notesElement
                      .remove();
                  }

                  signalGroup
                    .appendChild(
                      location
                    );
                }
              );

              bodyGroup
                .appendChild(
                  signalGroup
                );
            }
          );

          resultsContainer
            .appendChild(
              bodyGroup
            );
        }
      );
    }

    // -------------------------
    // FILTERING / SORTING
    // -------------------------

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
        selectedCommodity !==
        "all";

      const hasSearch =
        searchText !== "";

      if (
        !hasCommodityFilter &&
        !hasSearch
      ) {
        const preferredSites =
          miningData.filter(
            site =>
              site.preferred
          );

        renderSites(
          preferredSites,
          "Showing preferred mining sites"
        );

        return;
      }

      const filteredSites =
        miningData.filter(
          site => {
            const commodity =
              site.commodity
                .toLowerCase();

            const bodyLabel =
              formatBody(site)
                .toLowerCase();

            const signalText =
              `signal #${site.signal}`;

            const coordinateText =
              `${site.latitude}, ${site.longitude}`;

            const notes =
              (
                site.notes ||
                ""
              ).toLowerCase();

            const matchesCommodity =
              !hasCommodityFilter ||
              commodity ===
                selectedCommodity;

            const matchesSearch =
              !hasSearch ||
              commodity.includes(
                searchText
              ) ||
              bodyLabel.includes(
                searchText
              ) ||
              signalText.includes(
                searchText
              ) ||
              coordinateText.includes(
                searchText
              ) ||
              notes.includes(
                searchText
              );

            return (
              matchesCommodity &&
              matchesSearch
            );
          }
        );

      filteredSites.sort(
        (a, b) => {
          // Preferred first.
          if (
            a.preferred !==
            b.preferred
          ) {
            return a.preferred
              ? -1
              : 1;
          }

          // Body next.
          const bodyComparison =
            String(
              a.body
            ).localeCompare(
              String(
                b.body
              ),
              undefined,
              {
                numeric: true,
                sensitivity:
                  "base"
              }
            );

          if (
            bodyComparison !==
            0
          ) {
            return bodyComparison;
          }

          // Signal next.
          const signalComparison =
            Number(
              a.signal
            ) -
            Number(
              b.signal
            );

          if (
            signalComparison !==
            0
          ) {
            return signalComparison;
          }

          // Higher rig count next.
          const rigsA =
            a.rigs ?? -1;

          const rigsB =
            b.rigs ?? -1;

          if (
            rigsA !== rigsB
          ) {
            return (
              rigsB -
              rigsA
            );
          }

          // Recorded coordinates before
          // incomplete survey records.
          const aHasCoords =
            hasCoordinates(a);

          const bHasCoords =
            hasCoordinates(b);

          if (
            aHasCoords !==
            bHasCoords
          ) {
            return aHasCoords
              ? -1
              : 1;
          }

          return 0;
        }
      );

      let modeText =
        `Showing ${filteredSites.length} mining ${
          filteredSites.length === 1
            ? "location"
            : "locations"
        }`;

      if (
        hasCommodityFilter
      ) {
        const selectedLabel =
          commodityFilter.options[
            commodityFilter
              .selectedIndex
          ].text;

        modeText +=
          ` for ${selectedLabel}`;
      }

      renderSites(
        filteredSites,
        modeText
      );
    }

    commodityFilter
      .addEventListener(
        "change",
        applyMiningFilters
      );

    searchBox
      .addEventListener(
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
