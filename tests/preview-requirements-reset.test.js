const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("opening a mod resets the requirements card before loading metadata", () => {
  const source = fs.readFileSync("src/content.js", "utf8");
  const start = source.indexOf("async function openPreview(");
  const end = source.indexOf("async function getCanonicalModMeta(", start);
  const openPreview = source.slice(start, end);

  assert.match(
    openPreview,
    /renderDescription\(null\);\s*renderRequirements\(null\);/,
    "openPreview must clear the previous requirements state before fetching the new mod"
  );
});
