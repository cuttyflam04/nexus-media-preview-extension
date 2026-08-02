(() => {
  const BLOCK_TAGS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD",
    "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3",
    "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P",
    "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR",
    "UL"
  ]);
  const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

  function collectText(node) {
    if (!node) return "";
    if (node.nodeType === 3) return node.nodeValue || "";
    if (node.nodeType !== 1 || IGNORED_TAGS.has(node.tagName)) return "";

    const content = [...(node.childNodes || [])].map(collectText).join("");
    if (node.tagName === "BR") return "\n";
    return BLOCK_TAGS.has(node.tagName) ? `\n${content}\n` : content;
  }

  function cleanDescription(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\uFEFF/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function extractSeoSummary(doc, title) {
    const jsonDescription = [...doc.querySelectorAll("script[type='application/ld+json']")]
      .map((script) => {
        try {
          const data = JSON.parse(script.textContent);
          return Array.isArray(data)
            ? data.find((item) => item?.description)?.description
            : data?.description;
        } catch {
          return null;
        }
      })
      .find(Boolean);
    const raw =
      jsonDescription ||
      doc.querySelector("meta[property='og:description']")?.content ||
      doc.querySelector("meta[name='description']")?.content ||
      "";
    const summary = String(raw).trim().replace(/\s+/g, " ");

    if (!summary || summary === title || /Nexus Mods is a site/i.test(summary)) return null;
    return summary;
  }

  function findAboutHeading(doc) {
    const exact = doc.querySelector("#description_tab_h2");
    if (exact) return exact;
    return [...doc.querySelectorAll("h2,h3")]
      .find((heading) => /^about\s+this\s+mod$/i.test(cleanDescription(heading.textContent)));
  }

  function findSummaryElement(doc) {
    const heading = findAboutHeading(doc);
    const container = heading?.parentElement;
    if (!container?.children) return null;

    const children = [...container.children];
    const headingIndex = children.indexOf(heading);
    const summary = children
      .slice(headingIndex + 1)
      .find((element) => element.tagName === "P" && cleanDescription(collectText(element)));
    return summary || null;
  }

  function extract(doc, title = "") {
    if (!doc?.querySelectorAll) return null;

    const summary = cleanDescription(collectText(findSummaryElement(doc)));
    if (summary && summary !== title) return summary;
    return extractSeoSummary(doc, title);
  }

  globalThis.NexusMediaPreviewDescription = { extract };
})();
