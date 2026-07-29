(() => {
  const defaults = Object.freeze({
    showDescription: true,
    showAuthor: true,
    showRequirements: true,
    showYoutube: true,
    showActionButtons: true,
    openMode: "modal",
    keyboardShortcuts: true,
    modalWidth: "normal",
    showNexusVideos: true
  });

  const booleanKeys = [
    "showDescription",
    "showAuthor",
    "showRequirements",
    "showYoutube",
    "showActionButtons",
    "keyboardShortcuts",
    "showNexusVideos"
  ];

  function sanitize(raw = {}) {
    const source = raw && typeof raw === "object" ? raw : {};
    const result = { ...defaults };

    for (const key of booleanKeys) {
      if (typeof source[key] === "boolean") result[key] = source[key];
    }
    if (["modal", "new-tab", "same-tab"].includes(source.openMode)) result.openMode = source.openMode;
    if (["compact", "normal", "wide"].includes(source.modalWidth)) result.modalWidth = source.modalWidth;
    return result;
  }

  async function load() {
    try {
      if (typeof chrome === "undefined" || !chrome.storage?.sync) return { ...defaults };
      return sanitize(await chrome.storage.sync.get(defaults));
    } catch {
      return { ...defaults };
    }
  }

  async function save(next) {
    const value = sanitize(next);
    if (typeof chrome !== "undefined" && chrome.storage?.sync) {
      await chrome.storage.sync.set(value);
    }
    return value;
  }

  globalThis.NexusMediaPreviewSettings = { defaults, sanitize, load, save };
})();
