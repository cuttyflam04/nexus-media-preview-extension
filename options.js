(() => {
  const api = globalThis.NexusMediaPreviewSettings;
  const form = document.querySelector("#settings-form");
  const status = document.querySelector("#save-status");
  const resetButton = document.querySelector("#reset-settings");
  const kofiLink = document.querySelector("[data-kofi-link]");
  if (!api || !form) return;

  const KO_FI_URL = "https://ko-fi.com/cuttyflam04";
  if (kofiLink) {
    kofiLink.href = KO_FI_URL;
    kofiLink.hidden = false;
  }

  const keys = Object.keys(api.defaults);

  function readForm() {
    const values = {};
    for (const key of keys) {
      const field = form.elements.namedItem(key);
      values[key] = field.type === "checkbox" ? field.checked : field.value;
    }
    return api.sanitize(values);
  }

  function writeForm(settings) {
    for (const key of keys) {
      const field = form.elements.namedItem(key);
      if (field.type === "checkbox") field.checked = settings[key];
      else field.value = settings[key];
    }
  }

  let statusTimer = null;
  function showSaved() {
    status.textContent = "Settings saved";
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.textContent = ""; }, 1800);
  }

  api.load().then(writeForm);
  form.addEventListener("change", () => api.save(readForm()).then(showSaved));
  resetButton.addEventListener("click", () => api.save(api.defaults).then((settings) => {
    writeForm(settings);
    showSaved();
  }));
})();
