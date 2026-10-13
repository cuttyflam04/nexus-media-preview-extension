(() => {
  const NUMBER_WORDS = new Map([
    ["one", 1],
    ["two", 2],
    ["three", 3],
    ["four", 4],
    ["five", 5],
    ["six", 6],
    ["seven", 7],
    ["eight", 8],
    ["nine", 9],
    ["ten", 10]
  ]);

  function mediaCount(text) {
    const match = String(text || "")
      .replace(/\s+/g, " ")
      .match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:new\s+)?(?:images?|videos?|media)\b/i);
    if (!match) return null;

    const value = match[1].toLowerCase();
    return NUMBER_WORDS.get(value) || Number(value);
  }

  function metadata(node) {
    return [
      node?.id,
      node?.className,
      node?.getAttribute?.("data-testid"),
      node?.getAttribute?.("aria-label")
    ].filter(Boolean).join(" ");
  }

  function isNotificationRowMarker(node) {
    return /\bactivity(?:[-_ ]?(?:entry|item|row|card|list))?\b|\bnotification(?:[-_ ]?(?:entry|item|row|card|list))\b/i.test(metadata(node));
  }

  function findNotificationRow(node) {
    const chain = [];
    for (let current = node, depth = 0; current && depth < 12; depth += 1, current = current.parentElement) {
      chain.push(current);
    }

    const markedRow = chain.find((current) => isNotificationRowMarker(current));
    if (markedRow) return markedRow;

    const panelIndex = chain.findIndex((current) => /\bnotifications?\b/i.test(metadata(current)));
    if (panelIndex < 1) return null;

    const unmarkedRow = chain
      .slice(0, panelIndex)
      .find((current) => isGroupedMediaNotificationText(current.textContent));
    if (unmarkedRow) return unmarkedRow;

    for (const current of chain.slice(0, panelIndex)) {
      if (/^(?:ARTICLE|LI)$/i.test(current.tagName || "")) return current;
    }
    return null;
  }

  function isGroupedMediaNotificationText(text) {
    const count = mediaCount(text);
    return Number.isFinite(count) && count > 1;
  }

  function isGroupedMediaNotification(node) {
    return Boolean(getGroupedMediaInfo(node));
  }

  function getGroupedMediaInfo(node) {
    const row = findNotificationRow(node);
    const count = row && mediaCount(row.textContent);
    if (!row || !Number.isFinite(count) || count <= 1) return null;
    return { row, count };
  }

  globalThis.NexusMediaPreviewNotificationMedia = {
    mediaCount,
    isGroupedMediaNotificationText,
    isGroupedMediaNotification,
    getGroupedMediaInfo
  };
})();
