const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadInfoCards() {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync("src/info-cards.js", "utf8"), context);
  return context.globalThis.NexusMediaPreviewInfoCards;
}

test("expands an info card instantly and exposes its state accessibly", () => {
  const api = loadInfoCards();
  const card = {
    classList: {
      values: new Set(),
      toggle(name, enabled) {
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) { return this.values.has(name); }
    },
    attributes: new Map(),
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
  };

  assert.equal(api.toggle(card), true);
  assert.equal(card.classList.contains("is-expanded"), true);
  assert.equal(card.getAttribute("aria-expanded"), "true");
  assert.equal(api.toggle(card), false);
  assert.equal(card.classList.contains("is-expanded"), false);
  assert.equal(card.getAttribute("aria-expanded"), "false");
});

test("keeps the chevron control synchronized with the card state", () => {
  const api = loadInfoCards();
  const makeNode = () => ({
    classList: {
      values: new Set(),
      toggle(name, enabled) {
        if (enabled) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) { return this.values.has(name); }
    },
    attributes: new Map(),
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
  });
  const card = makeNode();
  const control = makeNode();

  api.toggle(card, control);

  assert.equal(card.getAttribute("aria-expanded"), "true");
  assert.equal(control.getAttribute("aria-expanded"), "true");
});
