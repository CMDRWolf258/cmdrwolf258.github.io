async function loadSystemData() {
  try {
    const response = await fetch("data/system.json");

    if (!response.ok) {
      throw new Error("Unable to load system data");
    }

    const data = await response.json();

    const populationElements =
      document.querySelectorAll(".live-population");

    populationElements.forEach(element => {
  const population = Number(data.population);

  element.textContent =
    (population / 1000000000).toFixed(2) + " Billion";

  element.title =
    population.toLocaleString() + " inhabitants";
});

  } catch (error) {
    console.error("System data error:", error);

    const populationElements =
      document.querySelectorAll(".live-population");

    populationElements.forEach(element => {
      element.textContent = "Data unavailable";
    });
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
