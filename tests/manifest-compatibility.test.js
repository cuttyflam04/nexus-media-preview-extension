const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("declares cross-browser background entry points for Chrome and Firefox", () => {
  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "src/background.js");
  assert.deepEqual(manifest.background.scripts, ["src/background.js"]);
  assert.equal(manifest.content_scripts[0].js.includes("src/description.js"), true);
});
