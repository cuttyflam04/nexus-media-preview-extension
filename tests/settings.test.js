const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadSettings() {
  const context = { globalThis: {}, console };
  vm.runInNewContext(fs.readFileSync("src/settings.js", "utf8"), context);
  return context.globalThis.NexusMediaPreviewSettings;
}

test("provides stable defaults for every user-facing preference", () => {
  const settings = loadSettings();

  assert.deepEqual(JSON.parse(JSON.stringify(settings.defaults)), {
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
});

test("sanitizes persisted preferences without accepting invalid values", () => {
  const settings = loadSettings();

  assert.deepEqual(JSON.parse(JSON.stringify(settings.sanitize({
    showDescription: false,
    showAuthor: 0,
    showRequirements: "yes",
    showYoutube: false,
    showActionButtons: false,
    openMode: "new-tab",
    keyboardShortcuts: false,
    modalWidth: "wide",
    showNexusVideos: false,
    unknown: "ignored"
  }))), {
    showDescription: false,
    showAuthor: true,
    showRequirements: true,
    showYoutube: false,
    showActionButtons: false,
    openMode: "new-tab",
    keyboardShortcuts: false,
    modalWidth: "wide",
    showNexusVideos: false
  });
});
