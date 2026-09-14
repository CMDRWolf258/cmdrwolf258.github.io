(function loadMiningClientModules() {
  const modules = [
    "mining-submit-core.js?v=4",
    "mining-material-ui.js?v=2"
  ];

  modules.forEach(src => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    document.body.appendChild(script);
  });
})();
