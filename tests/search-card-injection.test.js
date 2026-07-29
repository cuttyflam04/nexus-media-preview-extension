const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

class FakeElement {
  constructor(tagName, rect = { width: 0, height: 0 }) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.rect = rect;
    this.textContent = "Lookup Anything";
    this.className = "";
    this.classList = {
      add: (...names) => names.forEach((name) => this._addClass(name)),
      remove: (...names) => names.forEach((name) => this._removeClass(name)),
      contains: (name) => this._classes().includes(name)
    };
  }

  _classes() {
    return String(this.className || "").split(/\s+/).filter(Boolean);
  }

  _addClass(name) {
    if (!this._classes().includes(name)) this.className = [...this._classes(), name].join(" ");
  }

  _removeClass(name) {
    this.className = this._classes().filter((item) => item !== name).join(" ");
  }

  append(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === "class") this.className = String(value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  matches(selector) {
    if (selector === "body, html, header, nav") return false;
    if (selector === "a[href*='/mods/']") return this.tagName === "A" && Boolean(this.href);
    if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
    return false;
  }

  closest(selector) {
    if (selector.includes(".nmp-modal") || selector.includes(".nmp-lightbox")) return null;
    if (selector === ".nmp-search-card-host") {
      let current = this;
      while (current) {
        if (current.classList.contains("nmp-search-card-host")) return current;
        current = current.parentElement;
      }
      return null;
    }
    if (selector.includes("a[href*='/mods/']")) return this.tagName === "A" ? this : null;
    if (selector === "article") {
      let current = this.parentElement;
      while (current) {
        if (current.tagName === "ARTICLE") return current;
        current = current.parentElement;
      }
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    if (selector === "a[href*='/mods/']") return this.modAnchor ? [this.modAnchor] : [];
    if (selector === "img") return this.modImage ? [this.modImage] : [];
    if (selector === "input, [role='searchbox']") return this.searchInput ? [this.searchInput] : [];
    if (selector.includes("input[placeholder]")) {
      return this.searchInput?.hasAttribute("placeholder") ? [this.searchInput] : [];
    }
    if (selector === "[role='searchbox']") return this.searchInput?.getAttribute("role") === "searchbox" ? [this.searchInput] : [];
    if (selector.startsWith(".")) return this.children.filter((child) => child.classList.contains(selector.slice(1)));
    return [];
  }

  getBoundingClientRect() {
    return this.rect;
  }
}

function loadContentScript({ image, card, modAnchors = [], searchInputs = [] }) {
  const documentElement = new FakeElement("html");
  const body = new FakeElement("body");
  let mutationCallback = null;
  let observerOptions = null;
  const document = {
    documentElement,
    body,
    querySelectorAll(selector) {
      if (selector === "img") return [image];
      if (selector === "a[href*='/mods/']") return modAnchors;
      if (selector === "input, [role='searchbox']") return searchInputs;
      return [];
    },
    createElement(tagName) {
      return new FakeElement(tagName);
    },
    addEventListener() {}
  };
  const window = {
    addEventListener() {},
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    setTimeout,
    clearTimeout
  };
  const context = {
    console,
    document,
    window,
    location: { href: "https://www.nexusmods.com/skyrimspecialedition/mods/42", pathname: "/skyrimspecialedition/mods/42" },
    URL,
    NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 },
    MutationObserver: class {
      constructor(callback) {
        mutationCallback = callback;
      }

      observe(_target, options) {
        observerOptions = options;
      }
    },
    chrome: { runtime: { sendMessage() {} } },
    setTimeout,
    clearTimeout,
    requestAnimationFrame: window.requestAnimationFrame
  };
  vm.runInNewContext(fs.readFileSync("src/content.js", "utf8"), context);
  return {
    document,
    card,
    triggerMutation: (mutation = { type: "attributes" }) => {
      if (mutation.type !== "attributes" || observerOptions?.attributes) {
        mutationCallback?.([mutation]);
      }
    }
  };
}

test("injects a search-card preview after an image finishes loading", () => {
  const card = new FakeElement("article", { width: 340, height: 240 });
  card.className = "search-result-card";
  const image = new FakeElement("img");
  const anchor = new FakeElement("a");
  anchor.href = "https://www.nexusmods.com/skyrimspecialedition/mods/42";
  card.modAnchor = anchor;
  image.parentElement = card;

  const { document } = loadContentScript({ image, card });
  assert.equal(card.querySelector(".nmp-preview-button"), null);

  image.rect = { width: 340, height: 190 };
  image.dispatchEvent({ type: "load" });

  assert.ok(card.querySelector(".nmp-preview-button"));
  assert.ok(card.classList.contains("nmp-search-card-host"));
  assert.ok(document.body);
});

test("rescans a search card when its hidden container becomes visible", () => {
  const card = new FakeElement("article", { width: 0, height: 0 });
  card.className = "search-result-card";
  const image = new FakeElement("img");
  const anchor = new FakeElement("a");
  anchor.href = "https://www.nexusmods.com/skyrimspecialedition/mods/42";
  card.modAnchor = anchor;
  image.parentElement = card;

  const { triggerMutation } = loadContentScript({ image, card });
  assert.equal(card.querySelector(".nmp-preview-button"), null);

  card.rect = { width: 340, height: 240 };
  image.rect = { width: 340, height: 190 };
  triggerMutation();

  assert.ok(card.querySelector(".nmp-preview-button"));
});

test("does not add a search-card camera button to generic notification rows", () => {
  const notification = new FakeElement("article", { width: 340, height: 240 });
  notification.className = "activity-entry";
  const image = new FakeElement("img", { width: 340, height: 190 });
  image.complete = true;
  const anchor = new FakeElement("a");
  anchor.href = "https://www.nexusmods.com/skyrimspecialedition/mods/42";
  notification.modAnchor = anchor;
  anchor.parentElement = notification;
  notification.modImage = image;
  image.parentElement = notification;
  const panel = new FakeElement("section", { width: 600, height: 700 });
  panel.textContent = "Notifications";
  notification.parentElement = panel;

  loadContentScript({ image, card: notification, modAnchors: [anchor] });

  assert.equal(notification.querySelector(".nmp-preview-button"), null);
  assert.equal(notification.querySelector(".nmp-search-preview-button"), null);
});

test("recognizes search cards inside a dialog with a search field", () => {
  const searchDialog = new FakeElement("section", { width: 900, height: 700 });
  searchDialog.setAttribute("role", "dialog");
  searchDialog.searchInput = new FakeElement("input");
  const card = new FakeElement("article", { width: 340, height: 240 });
  const image = new FakeElement("img", { width: 340, height: 190 });
  image.complete = true;
  const anchor = new FakeElement("a");
  anchor.href = "https://www.nexusmods.com/skyrimspecialedition/mods/42";
  card.modAnchor = anchor;
  card.parentElement = searchDialog;
  image.parentElement = card;

  loadContentScript({ image, card });

  assert.ok(card.querySelector(".nmp-search-preview-button"));
});

test("recognizes a search panel without a semantic role when it owns an input", () => {
  const searchPanel = new FakeElement("section", { width: 900, height: 700 });
  searchPanel.searchInput = new FakeElement("input");
  const card = new FakeElement("article", { width: 340, height: 240 });
  const image = new FakeElement("img", { width: 340, height: 190 });
  image.complete = true;
  const anchor = new FakeElement("a");
  anchor.href = "https://www.nexusmods.com/skyrimspecialedition/mods/42";
  card.modAnchor = anchor;
  card.parentElement = searchPanel;
  image.parentElement = card;

  loadContentScript({ image, card });

  assert.ok(card.querySelector(".nmp-search-preview-button"));
});

test("recognizes portal search results on a mod page from the active query", () => {
  const card = new FakeElement("article", { width: 340, height: 240 });
  const image = new FakeElement("img", { width: 340, height: 190 });
  image.complete = true;
  const anchor = new FakeElement("a");
  anchor.href = "https://www.nexusmods.com/skyrimspecialedition/mods/42";
  card.modAnchor = anchor;
  image.parentElement = card;
  const searchInput = new FakeElement("input");
  searchInput.value = "dusk";

  loadContentScript({ image, card, searchInputs: [searchInput] });

  assert.ok(card.querySelector(".nmp-search-preview-button"));
});

test("recognizes an unmarked result card when Nexus omits search metadata", () => {
  const card = new FakeElement("article", { width: 340, height: 240 });
  const image = new FakeElement("img", { width: 340, height: 190 });
  image.complete = true;
  const anchor = new FakeElement("a");
  anchor.href = "https://www.nexusmods.com/skyrimspecialedition/mods/42";
  card.modAnchor = anchor;
  image.parentElement = card;

  loadContentScript({ image, card });

  assert.ok(card.querySelector(".nmp-search-preview-button"));
});

test("removes a stale camera button when a card is later recognized as a non-search row", () => {
  const notification = new FakeElement("article", { width: 340, height: 240 });
  notification.className = "activity-entry nmp-search-card-host";
  const staleButton = new FakeElement("button");
  staleButton.className = "nmp-preview-button nmp-search-preview-button";
  notification.append(staleButton);
  const image = new FakeElement("img", { width: 340, height: 190 });
  image.complete = true;
  const anchor = new FakeElement("a");
  anchor.href = "https://www.nexusmods.com/skyrimspecialedition/mods/42";
  notification.modAnchor = anchor;
  image.parentElement = notification;
  const panel = new FakeElement("section", { width: 600, height: 700 });
  panel.textContent = "Notifications";
  notification.parentElement = panel;

  loadContentScript({ image, card: notification });

  assert.equal(notification.querySelector(".nmp-search-preview-button"), null);
  assert.equal(notification.classList.contains("nmp-search-card-host"), false);
});
