(() => {
  function setExpanded(card, expanded, control = card) {
    if (!card) return false;
    card.classList.toggle("is-expanded", expanded);
    card.setAttribute("aria-expanded", String(expanded));
    control?.setAttribute?.("aria-expanded", String(expanded));
    return expanded;
  }

  function toggle(card, control = card) {
    return setExpanded(card, !card.classList.contains("is-expanded"), control);
  }

  globalThis.NexusMediaPreviewInfoCards = { setExpanded, toggle };
})();
