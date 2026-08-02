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

function documentWith({ root = null, scripts = [], meta = null } = {}) {
  return {
    querySelector(selector) {
      if (selector === ".mod_description_container") return root;
      if (selector === "meta[property='og:description']" || selector === "meta[name='description']") return meta;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[class*='mod_description_container']") return root ? [root] : [];
      if (selector === "script[type='application/ld+json']") return scripts;
      return [];
    }
  };
}

test("extracts the full Nexus description container instead of the SEO summary", () => {
  const api = loadDescription();
  const root = element("DIV", [
    element("DIV", [text("First paragraph.")]),
    element("DIV", [text("Second paragraph."), element("BR"), text("Still complete.")]),
    element("SCRIPT", [text("must be ignored")])
  ], "container mod_description_container condensed");
  const document = documentWith({
    root,
    scripts: [{ textContent: JSON.stringify({ description: "Short SEO excerpt" }) }]
  });

  assert.equal(api.extract(document, "Example mod"), "First paragraph.\n\nSecond paragraph.\nStill complete.");
});

test("falls back to the SEO description when Nexus has no full description container", () => {
  const api = loadDescription();
  const document = documentWith({
    scripts: [{ textContent: JSON.stringify({ description: "Short SEO excerpt" }) }]
  });

  assert.equal(api.extract(document, "Example mod"), "Short SEO excerpt");
});
