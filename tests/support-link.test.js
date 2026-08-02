const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

test("keeps the Ko-fi support link discreet and dynamically assigned", () => {
  const html = fs.readFileSync("options.html", "utf8");
  const script = fs.readFileSync("options.js", "utf8");

  assert.match(html, /data-kofi-link/);
  assert.match(html, /support its development/);
  assert.match(script, /KO_FI_URL\s*=\s*["']https:\/\/ko-fi\.com\/cuttyflam04["']/);
  assert.match(script, /kofiLink\.href\s*=\s*KO_FI_URL/);
});
