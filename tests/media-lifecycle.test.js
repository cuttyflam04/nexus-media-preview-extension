const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

test("stops embedded video players when the preview closes", () => {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync("src/media-lifecycle.js", "utf8"), context);
  const first = { attributes: new Map([["src", "https://www.youtube.com/embed/one"]]), setAttribute(name, value) { this.attributes.set(name, value); } };
  const second = { attributes: new Map([["src", "https://www.youtube.com/embed/two"]]), setAttribute(name, value) { this.attributes.set(name, value); } };
  const root = { querySelectorAll(selector) { assert.equal(selector, "iframe"); return [first, second]; } };

  context.globalThis.NexusMediaPreviewMediaLifecycle.stopEmbeddedVideos(root);

  assert.equal(first.attributes.get("src"), "about:blank");
  assert.equal(second.attributes.get("src"), "about:blank");
});
