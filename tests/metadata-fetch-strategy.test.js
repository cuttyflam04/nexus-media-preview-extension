const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("uses the Description-tab request only as a metadata fallback", () => {
  const source = fs.readFileSync("src/content.js", "utf8");
  const start = source.indexOf("async function loadCanonicalModMeta(");
  const end = source.indexOf("function parseCanonicalModMeta(", start);
  const strategy = source.slice(start, end);

  assert.match(strategy, /if \(primary\?\.summary\) return primary/);
  assert.doesNotMatch(strategy, /Promise\.allSettled/);
});
