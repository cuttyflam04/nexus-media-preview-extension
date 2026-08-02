const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadRequirements() {
  const context = { globalThis: {} };
  vm.runInNewContext(fs.readFileSync("src/requirements.js", "utf8"), context);
  return context.globalThis.NexusMediaPreviewRequirements;
}

function node({ tagName = "DIV", textContent = "", id = "", className = "", href = "", parentElement = null, children = [] } = {}) {
  const value = { tagName, textContent, id, className, parentElement, children, href };
  for (const child of children) child.parentElement = value;
  value.getAttribute = (name) => ({ id, class: className, href }[name] || null);
  value.closest = () => null;
  value.querySelectorAll = (selector) => {
    const descendants = [];
    const visit = (item) => {
      for (const child of item.children || []) {
        descendants.push(child);
        visit(child);
      }
    };
    visit(value);
    if (selector === "a[href*='/mods/']") return descendants.filter((item) => item.tagName === "A" && item.href);
    return [];
  };
  return value;
}

test("extracts requirement links that point to a mod Files tab", () => {
  const api = loadRequirements();
  const first = node({ tagName: "A", textContent: "Skyrim Script Extender (SKSE64) Steam", href: "/skyrimspecialedition/mods/30379?tab=files" });
  const second = node({ tagName: "A", textContent: "XPMSSE", href: "/skyrimspecialedition/mods/1988?tab=files" });
  const legacyRequirement = node({ tagName: "A", textContent: "Legacy Dependency", href: "/skyrimspecialedition/mods/5000" });
  const section = node({ id: "mod-file-requirements", textContent: "Mod file requirements", children: [first, second, legacyRequirement] });
  const document = {
    querySelectorAll(selector) {
      if (selector === "a[href*='/mods/']") return [first, second, legacyRequirement];
      if (selector.includes("requirements")) return [section];
      return [];
    }
  };
  const normalize = (href) => {
    const match = href.match(/mods\/(\d+)/);
    return match ? { modId: match[1], url: `https://www.nexusmods.com/skyrimspecialedition/mods/${match[1]}` } : null;
  };

  assert.deepEqual(JSON.parse(JSON.stringify(api.extract(document, normalize))), [
    { name: "Skyrim Script Extender (SKSE64) Steam", url: "https://www.nexusmods.com/skyrimspecialedition/mods/30379" },
    { name: "XPMSSE", url: "https://www.nexusmods.com/skyrimspecialedition/mods/1988" },
    { name: "Legacy Dependency", url: "https://www.nexusmods.com/skyrimspecialedition/mods/5000" }
  ]);
});

test("ignores description, translation, and other mod links inside the requirements section", () => {
  const api = loadRequirements();
  const filesRequirement = node({
    tagName: "A",
    textContent: "Address Library for SKSE Plugins",
    href: "/skyrimspecialedition/mods/32444?tab=files"
  });
  const descriptionTab = node({
    tagName: "A",
    textContent: "Description",
    href: "/skyrimspecialedition/mods/186468?tab=description"
  });
  const germanTranslation = node({
    tagName: "A",
    textContent: "German",
    href: "/skyrimspecialedition/mods/70001?tab=description"
  });
  const ukrainianTranslation = node({
    tagName: "A",
    textContent: "Ukrainian",
    href: "/skyrimspecialedition/mods/70002?tab=description"
  });
  const section = node({
    id: "mod-file-requirements",
    textContent: "Mod file requirements German Ukrainian",
    children: [filesRequirement, descriptionTab, germanTranslation, ukrainianTranslation]
  });
  const document = {
    querySelectorAll(selector) {
      if (selector === "a[href*='/mods/']") {
        return [filesRequirement, descriptionTab, germanTranslation, ukrainianTranslation];
      }
      if (selector.includes("requirements")) return [section];
      return [];
    }
  };
  const normalize = (href) => {
    const match = href.match(/mods\/(\d+)/);
    return match ? { modId: match[1], url: `https://www.nexusmods.com/skyrimspecialedition/mods/${match[1]}` } : null;
  };

  assert.deepEqual(JSON.parse(JSON.stringify(api.extract(document, normalize))), [
    { name: "Address Library for SKSE Plugins", url: "https://www.nexusmods.com/skyrimspecialedition/mods/32444" }
  ]);
});

test("does not treat a broad page wrapper mentioning requirements as a requirements container", () => {
  const api = loadRequirements();
  const dependency = node({
    tagName: "A",
    textContent: "Address Library for SKSE Plugins",
    href: "/skyrimspecialedition/mods/32444?tab=files"
  });
  const translation = node({
    tagName: "A",
    textContent: "German",
    href: "/skyrimspecialedition/mods/70001?tab=files"
  });
  const broadWrapper = node({
    className: "page-content",
    textContent: "Requirements German translation",
    children: [dependency, translation]
  });
  const document = {
    querySelectorAll(selector) {
      if (selector === "a[href*='/mods/']") return [dependency, translation];
      return [];
    }
  };
  const normalize = (href) => {
    const match = href.match(/mods\/(\d+)/);
    return match ? { modId: match[1], url: `https://www.nexusmods.com/skyrimspecialedition/mods/${match[1]}` } : null;
  };

  assert.equal(api.extract(document, normalize), null);
  assert.equal(broadWrapper.textContent.includes("Requirements"), true);
});

test("filters language and Description links from a Files-tab requirements block", () => {
  const api = loadRequirements();
  const dependency = node({
    tagName: "A",
    textContent: "Address Library for SKSE Plugins",
    href: "/skyrimspecialedition/mods/32444?tab=files"
  });
  const german = node({ tagName: "A", textContent: "German", href: "/skyrimspecialedition/mods/70001?tab=files" });
  const ukrainian = node({ tagName: "A", textContent: "Ukrainian", href: "/skyrimspecialedition/mods/70002?tab=files" });
  const description = node({ tagName: "A", textContent: "Description", href: "/skyrimspecialedition/mods/186468?tab=files" });
  const section = node({ id: "mod-file-requirements", children: [dependency, german, ukrainian, description] });
  const document = {
    querySelectorAll(selector) {
      if (selector === "a[href*='/mods/']") return [dependency, german, ukrainian, description];
      if (selector.includes("requirements")) return [section];
      return [];
    }
  };
  const normalize = (href) => {
    const match = href.match(/mods\/(\d+)/);
    return match ? { modId: match[1], url: `https://www.nexusmods.com/skyrimspecialedition/mods/${match[1]}` } : null;
  };

  assert.deepEqual(JSON.parse(JSON.stringify(api.extract(document, normalize))), [
    { name: "Address Library for SKSE Plugins", url: "https://www.nexusmods.com/skyrimspecialedition/mods/32444" }
  ]);
});

test("finds dependencies under a Nexus requirements heading when the wrapper has no semantic class", () => {
  const api = loadRequirements();
  const dependency = node({
    tagName: "A",
    textContent: "Address Library for SKSE Plugins",
    href: "/skyrimspecialedition/mods/32444"
  });
  const wrapper = node({ children: [dependency] });
  const heading = { tagName: "H3", textContent: "Nexus requirements", parentElement: wrapper };
  const document = {
    querySelectorAll(selector) {
      if (selector === "a[href*='/mods/']") return [dependency];
      if (selector === "h1,h2,h3,h4,h5,h6") return [heading];
      if (selector.includes("requirements")) return [];
      return [];
    }
  };
  const normalize = (href) => {
    const match = href.match(/mods\/(\d+)/);
    return match ? { modId: match[1], url: `https://www.nexusmods.com/skyrimspecialedition/mods/${match[1]}` } : null;
  };

  assert.deepEqual(JSON.parse(JSON.stringify(api.extract(document, normalize))), [
    { name: "Address Library for SKSE Plugins", url: "https://www.nexusmods.com/skyrimspecialedition/mods/32444" }
  ]);
});

test("keeps absolute Files-tab links with additional Nexus query parameters", () => {
  const api = loadRequirements();
  const dependency = node({
    tagName: "A",
    textContent: "Address Library for SKSE Plugins",
    href: "https://www.nexusmods.com/skyrimspecialedition/mods/32444?tab=files&file_id=123456"
  });
  const section = node({ id: "mod-file-requirements", children: [dependency] });
  const document = {
    querySelectorAll(selector) {
      if (selector === "a[href*='/mods/']") return [dependency];
      if (selector.includes("requirements")) return [section];
      return [];
    }
  };
  const normalize = (href) => {
    const match = href.match(/mods\/(\d+)/);
    return match ? { modId: match[1], url: `https://www.nexusmods.com/skyrimspecialedition/mods/${match[1]}` } : null;
  };

  assert.deepEqual(JSON.parse(JSON.stringify(api.extract(document, normalize))), [
    { name: "Address Library for SKSE Plugins", url: "https://www.nexusmods.com/skyrimspecialedition/mods/32444" }
  ]);
});

test("uses the raw href when the DOM property omits the Files-tab query", () => {
  const api = loadRequirements();
  const dependency = {
    tagName: "A",
    textContent: "Address Library for SKSE Plugins",
    href: "https://www.nexusmods.com/skyrimspecialedition/mods/32444",
    parentElement: null,
    getAttribute(name) {
      return name === "href" ? "/skyrimspecialedition/mods/32444?tab=files" : null;
    }
  };
  const section = node({ id: "mod-file-requirements", children: [dependency] });
  dependency.parentElement = section;
  const document = {
    querySelectorAll(selector) {
      if (selector === "a[href*='/mods/']") return [dependency];
      if (selector.includes("requirements")) return [section];
      return [];
    }
  };
  const normalize = (href) => {
    const match = href.match(/mods\/(\d+)/);
    return match ? { modId: match[1], url: `https://www.nexusmods.com/skyrimspecialedition/mods/${match[1]}` } : null;
  };

  assert.deepEqual(JSON.parse(JSON.stringify(api.extract(document, normalize))), [
    { name: "Address Library for SKSE Plugins", url: "https://www.nexusmods.com/skyrimspecialedition/mods/32444" }
  ]);
});
