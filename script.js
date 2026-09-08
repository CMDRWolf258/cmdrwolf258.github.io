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
