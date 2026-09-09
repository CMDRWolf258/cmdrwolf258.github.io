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
