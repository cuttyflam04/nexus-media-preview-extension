const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("declares cross-browser background entry points for Chrome and Firefox", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.deepEqual(manifest.background.scripts, ["src/background.js"]);
  assert.equal(manifest.content_scripts[0].js.includes("src/description.js"), true);
  assert.equal(manifest.content_scripts[0].js.includes("src/modal-drag.js"), true);
  assert.deepEqual(manifest.web_accessible_resources[0].resources, ["src/viewer.css"]);
});

test("loads every content script dependency before content.js", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  const scripts = manifest.content_scripts[0].js;

  for (const file of scripts) assert.equal(fs.existsSync(file), true, `${file} is missing`);
  assert.equal(scripts.at(-1), "src/content.js");
  assert.ok(scripts.indexOf("src/description.js") < scripts.indexOf("src/sources.js"));
});
