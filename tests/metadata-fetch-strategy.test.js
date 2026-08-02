const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("uses one canonical metadata request per preview", () => {
  const source = fs.readFileSync("src/content.js", "utf8");
  const start = source.indexOf("async function loadCanonicalModMeta(");
  const end = source.indexOf("function parseCanonicalModMeta(", start);
  const strategy = source.slice(start, end);

  assert.match(strategy, /fetchPageHtml\(mod\.url\)/);
  assert.doesNotMatch(strategy, /tab=description/);
  assert.doesNotMatch(strategy, /Promise\.allSettled/);
});
