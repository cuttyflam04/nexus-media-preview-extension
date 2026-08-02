const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadDescription() {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync("src/description.js", "utf8"), context);
  return context.globalThis.NexusMediaPreviewDescription;
}

function text(value) {
  return { nodeType: 3, nodeValue: value };
}

function element(tagName, children = [], className = "") {
  return {
    nodeType: 1,
    tagName,
    className,
    childNodes: children,
    textContent: children.map((child) => child.nodeValue || child.textContent || "").join("")
  };
}

function documentWith({ summary = null, scripts = [], meta = null } = {}) {
  const heading = summary ? element("H2", [text("About this mod")]) : null;
  const container = summary ? { children: [heading, summary], querySelectorAll: () => [] } : null;
  if (heading) heading.parentElement = container;
  if (summary) summary.parentElement = container;
  return {
    querySelector(selector) {
      if (selector === "#description_tab_h2") return heading;
      if (selector === "meta[property='og:description']" || selector === "meta[name='description']") return meta;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "h2,h3") return heading ? [heading] : [];
      if (selector === "script[type='application/ld+json']") return scripts;
      return [];
    }
  };
}

test("extracts only the short summary under About this mod", () => {
  const api = loadDescription();
  const summary = element("P", [text("Short summary only.")]);
  const document = documentWith({
    summary,
    scripts: [{ textContent: JSON.stringify({ description: "SEO excerpt" }) }]
  });

  assert.equal(api.extract(document, "Example mod"), "Short summary only.");
});

test("falls back to the SEO description when Nexus has no full description container", () => {
  const api = loadDescription();
  const document = documentWith({
    scripts: [{ textContent: JSON.stringify({ description: "Short SEO excerpt" }) }]
  });

  assert.equal(api.extract(document, "Example mod"), "Short SEO excerpt");
});
