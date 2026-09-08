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
      element.textContent =
        Number(data.population).toLocaleString();
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
