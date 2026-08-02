(() => {
  const IGNORED_NAMES = new Set([
    "description", "english", "german", "french", "italian", "spanish", "polish",
    "russian", "ukrainian", "mandarin", "turkish", "portuguese", "brazilian portuguese",
    "chinese", "simplified chinese", "traditional chinese", "japanese", "korean", "dutch",
    "czech", "hungarian", "arabic"
  ]);

  function anchorHref(anchor) {
    return anchor?.getAttribute?.("href") || anchor?.href || anchor?.getAttribute?.("data-href") || anchor?.getAttribute?.("data-url") || "";
  }

  function isRequirementLink(anchor) {
    const href = anchorHref(anchor);
    if (!href) return true;
    try {
      const tab = new URL(href, "https://www.nexusmods.com/").searchParams.get("tab")?.toLowerCase();
      return !tab || tab === "files";
    } catch {
      return !/[?&]tab=(?!files(?:&|$))[^&#]*/i.test(href);
    }
  }

  function isUsableRequirementName(value) {
    const name = String(value || "").trim().replace(/\s+/g, " ");
    return Boolean(name) && !IGNORED_NAMES.has(name.toLowerCase());
  }

  function extract(doc, normalizeModUrl) {
    if (!doc?.querySelectorAll || typeof normalizeModUrl !== "function") return null;

    const anchors = [...doc.querySelectorAll("a[href*='/mods/']")];
    const matches = [];
    const seen = new Set();

    for (const anchor of anchors) {
      if (!isRequirementLink(anchor)) continue;
      let current = anchor;
      let isRequirement = false;
      for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
        const signature = [
          current.id,
          current.className,
          current.getAttribute?.("aria-label"),
          current.getAttribute?.("data-testid")
        ].filter(Boolean).join(" ");
        if (/\brequirements?\b/i.test(signature)) {
          isRequirement = true;
          break;
        }
        if (/^(BODY|HTML|NAV|HEADER|MAIN)$/i.test(current.tagName || "")) break;
      }
      if (!isRequirement) continue;
      const name = anchor.textContent.trim() || "";
      if (!isUsableRequirementName(name)) continue;

      const modUrl = normalizeModUrl(anchorHref(anchor));
      if (!modUrl || seen.has(modUrl.url)) continue;
      seen.add(modUrl.url);
      matches.push({
        name: name || `Mod ${modUrl.modId}`,
        url: modUrl.url
      });
    }

    if (matches.length) return matches;

    // Fallback for markup where requirement links are nested below a
    // semantic requirements container but its text is not repeated on each
    // row.
    const roots = [...doc.querySelectorAll("[id*='requirements'], [class*='requirement'], [data-testid*='requirement']")];
    for (const root of roots) {
      for (const anchor of root.querySelectorAll("a[href*='/mods/']")) {
        if (!isRequirementLink(anchor)) continue;
        const name = anchor.textContent.trim() || "";
        if (!isUsableRequirementName(name)) continue;
        const modUrl = normalizeModUrl(anchorHref(anchor));
        if (!modUrl || seen.has(modUrl.url)) continue;
        seen.add(modUrl.url);
        matches.push({
          name: name || `Mod ${modUrl.modId}`,
          url: modUrl.url
        });
      }
    }

    if (matches.length) return matches;

    // Some Nexus layouts expose only the visible heading, without a semantic
    // class or id on the surrounding requirements panel.
    const headings = [...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter((heading) => /^Nexus\s+requirements$/i.test(String(heading.textContent || "").trim()));
    for (const heading of headings) {
      let root = heading.parentElement;
      for (let depth = 0; root && depth < 6; depth += 1, root = root.parentElement) {
        const links = [...(root.querySelectorAll?.("a[href*='/mods/']") || [])];
        if (!links.length) continue;
        for (const anchor of links) {
          if (!isRequirementLink(anchor)) continue;
          const name = anchor.textContent.trim() || "";
          if (!isUsableRequirementName(name)) continue;
          const modUrl = normalizeModUrl(anchorHref(anchor));
          if (!modUrl || seen.has(modUrl.url)) continue;
          seen.add(modUrl.url);
          matches.push({
            name: name || `Mod ${modUrl.modId}`,
            url: modUrl.url
          });
        }
        break;
      }
    }

    return matches.length ? matches : null;
  }

  globalThis.NexusMediaPreviewRequirements = { extract };
})();
