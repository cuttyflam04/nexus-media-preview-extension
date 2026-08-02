(() => {
  const BUTTON_CLASS = "nmp-preview-button";
  const PROCESSED_ATTR = "data-nmp-processed";
  const INLINE_PROCESSED_ATTR = "data-nmp-inline-processed";
  const MEDIA_LINK_PROCESSED_ATTR = "data-nmp-media-link-processed";
  const PROFILE_MEDIA_PROCESSED_ATTR = "data-nmp-profile-media-processed";
  const IMAGE_SCAN_LISTENER_ATTR = "data-nmp-image-scan-listener";
  const MOD_URL_RE = /^https:\/\/www\.nexusmods\.com\/([^\/?#]+)\/mods\/(\d+)/i;
  const fallbackSettings = {
    defaults: {
      showDescription: true,
      showAuthor: true,
      showRequirements: true,
      showYoutube: true,
      showActionButtons: true,
      openMode: "modal",
      keyboardShortcuts: true,
      modalWidth: "normal",
      showNexusVideos: true
    },
    sanitize(value) { return { ...this.defaults, ...(value || {}) }; },
    async load() { return { ...this.defaults }; }
  };
  const settingsApi = globalThis.NexusMediaPreviewSettings || fallbackSettings;
  const infoCardApi = globalThis.NexusMediaPreviewInfoCards || {
    setExpanded(card, expanded, control = card) {
      card.classList.toggle("is-expanded", expanded);
      card.setAttribute("aria-expanded", String(expanded));
      control?.setAttribute?.("aria-expanded", String(expanded));
      return expanded;
    },
    toggle(card, control = card) {
      return this.setExpanded(card, !card.classList.contains("is-expanded"), control);
    }
  };
  const mediaLifecycleApi = globalThis.NexusMediaPreviewMediaLifecycle || {
    stopEmbeddedVideos(root) {
      for (const iframe of root?.querySelectorAll?.("iframe") || []) iframe.setAttribute("src", "about:blank");
    }
  };
  const requirementsApi = globalThis.NexusMediaPreviewRequirements || {
    extract() { return null; }
  };
  const descriptionApi = globalThis.NexusMediaPreviewDescription || {
    extract() { return null; }
  };
  let userSettings = settingsApi.sanitize(settingsApi.defaults);
  const settingsReady = settingsApi.load().then((value) => {
    userSettings = settingsApi.sanitize(value);
    applyModalSettings();
    return userSettings;
  });
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;
      const next = { ...userSettings };
      for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
      userSettings = settingsApi.sanitize(next);
      applyModalSettings();
    });
  }
  const mediaCache = new Map();
  const modMetaCache = new Map();
  const pageHtmlCache = new Map();
  const clipboardBlobCache = new Map();
  let injectScheduled = false;

  const state = {
    modal: null,
    title: null,
    body: null,
    downloadStatus: null,
    downloadInfo: null,
    authorButton: null,
    authorButtonLabel: null,
    totalDownloadsCard: null,
    totalDownloadsValue: null,
    descriptionCard: null,
    descriptionText: null,
    requirementsCard: null,
    requirementsList: null,
    previousModButton: null,
    nextModButton: null,
    lightbox: null,
    lightboxImage: null,
    lightboxCaption: null,
    lightboxCounter: null,
    lightboxScale: 1,
    activeCard: null,
    linkPopover: null,
    linkPopoverButton: null,
    linkPopoverTimer: null,
    activeInlineLink: null,
    activeLinkPreview: null,
    currentMedia: [],
    currentMod: null,
    profileMediaMode: false,
    currentIndex: 0
  };

  function normalizeModUrl(href) {
    try {
      const url = new URL(href, location.href);
      const match = url.href.match(MOD_URL_RE);
      if (!match) return null;
      return {
        game: match[1],
        modId: match[2],
        url: `https://www.nexusmods.com/${match[1]}/mods/${match[2]}`
      };
    } catch {
      return null;
    }
  }

  function normalizeMediaUrl(href) {
    try {
      const url = new URL(href, location.href);
      if (url.hostname !== "www.nexusmods.com") return null;
      if (normalizeModUrl(url.href)) return null;

      const path = url.pathname.replace(/\/+$/, "");
      const supported =
        /\/(?:images|videos)\/\d+$/i.test(path) ||
        /\/profile\/[^/]+\/media(?:\/|$)/i.test(path);
      if (!supported) return null;

      return {
        kind: /\/videos\//i.test(path) ? "video" : "image",
        url: url.href.split("#")[0]
      };
    } catch {
      return null;
    }
  }

  function findCard(anchor) {
    const selectors = [
      "article",
      "[class*='mod-tile']",
      "[class*='mod-tile-left']",
      "[class*='mod-card']",
      "[class*='modresult']",
      "[class*='search-result']",
      "[class*='search_results']",
      "[class*='search-item']",
      "[class*='searchresult']",
      "[class*='result-item']",
      "[class*='grid-item']",
      "[class*='mod-item']",
      "[role='listitem']",
      ".mod-tile"
    ];

    for (const selector of selectors) {
      const card = anchor.closest(selector);
      if (card && isUsableModCard(card) && findImageArea(card)) return card;
    }

    let node = anchor.parentElement;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      if (node.matches("body, html, header, nav")) break;
      if (isUsableModCard(node) && findImageArea(node)) return node;
    }

    return null;
  }

  function isUsableModCard(card) {
    if (!card || card.closest(".nmp-modal, .nmp-lightbox")) return false;
    if (!card.querySelector("a[href*='/mods/']") || !card.querySelector("img")) return false;

    const rect = card.getBoundingClientRect();
    if (rect.width < 120 || rect.height < 90) return false;
    if (rect.width > 620 || rect.height > 720) return false;

    const modLinks = card.querySelectorAll("a[href*='/mods/']").length;
    const images = card.querySelectorAll("img").length;
    return modLinks <= 6 && images <= 6;
  }

  function findImageArea(card) {
    if (card.matches("a[href*='/mods/']") && card.querySelector("img")) return card;

    const area =
      card.querySelector("figure") ||
      card.querySelector("[class*='image']") ||
      card.querySelector("[class*='thumbnail']") ||
      card.querySelector("[class*='picture']");

    if (area?.querySelector("img, picture, source")) return area;

    // If the card itself contains an image directly, try the card
    const image = card.querySelector("img");
    const imageAnchor = image?.closest("a[href*='/mods/']");
    if (imageAnchor && card.contains(imageAnchor)) return imageAnchor;
    if (image) return image.parentElement || card;

    return [...card.querySelectorAll("a[href*='/mods/']")]
      .find((link) => link.querySelector("img, picture, source")) || null;
  }

  function getTitle(card, fallback) {
    const heading = card.querySelector("h1, h2, h3, h4");
    const headingText = cleanTitle(heading?.textContent);
    if (headingText) return headingText;

    const matchingLinks = [...card.querySelectorAll("a[href*='/mods/']")]
      .filter((link) => link.textContent.trim() && !link.querySelector("img, picture"))
      .sort((a, b) => b.textContent.trim().length - a.textContent.trim().length);
    return cleanTitle(matchingLinks[0]?.textContent) || fallback;
  }

  function injectButtons() {
    injectProfileMediaButtons();
    injectMediaLinkButtons();
    injectImageResultButtons();
    const anchors = [...document.querySelectorAll("a[href*='/mods/']")];
    for (const anchor of anchors) {
      if (anchor.closest(".nmp-modal, .nmp-lightbox")) continue;

      const mod = normalizeModUrl(anchor.href);
      if (!mod) continue;

      const card = findCard(anchor);
      if (!card) {
        if (shouldIgnoreInlineLink(anchor, mod)) {
          anchor.removeAttribute(INLINE_PROCESSED_ATTR);
          anchor.classList.remove("nmp-inline-link");
          continue;
        }
        injectInlineButton(anchor, mod);
        continue;
      }

      // Activity/notification rows can look like compact mod cards to the
      // generic card detector. Keep those on the inline Media path instead
      // of adding the card camera overlay.
      if (isNotificationContext(card)) {
        injectInlineButton(anchor, mod);
        continue;
      }

      if (anchor.hasAttribute(INLINE_PROCESSED_ATTR)) {
        anchor.removeAttribute(INLINE_PROCESSED_ATTR);
      }

      const existingButton = card.querySelector(`.${BUTTON_CLASS}`);
      if (card.getAttribute(PROCESSED_ATTR) === mod.url && existingButton) continue;
      if (existingButton) existingButton.remove();

      const target = findImageArea(card);
      if (!target) continue;

      card.setAttribute(PROCESSED_ATTR, mod.url);
      target.classList.add("nmp-preview-host");

      const button = createPreviewButton();
      bindPreviewButton(button, mod, () => getTitle(card, `Mod ${mod.modId}`), card);
      target.append(button);
    }
  }

  function injectImageResultButtons() {
    for (const image of document.querySelectorAll("img")) {
      if (image.closest(".nmp-modal, .nmp-lightbox, header, nav")) continue;
      if (!isSearchResultContext(image)) {
        removeStaleSearchPreview(image);
        continue;
      }
      const imageRect = image.getBoundingClientRect();
      const needsLoadWatch = !image.complete || imageRect.width < 120 || imageRect.height < 80;
      if (needsLoadWatch && !image.hasAttribute(IMAGE_SCAN_LISTENER_ATTR)) {
        image.setAttribute(IMAGE_SCAN_LISTENER_ATTR, "true");
        image.addEventListener("load", scheduleInjectButtons);
      }
      if (imageRect.width < 120 || imageRect.height < 80) continue;

      const card = findResultCardFromImage(image);
      if (!card) continue;
      const modLink = [...card.querySelectorAll("a[href*='/mods/']")]
        .map((anchor) => ({ anchor, mod: normalizeModUrl(anchor.href) }))
        .find((entry) => entry.mod)?.anchor;
      const mod = normalizeModUrl(modLink?.href);
      if (!mod) continue;

      if (card.querySelector(`.${BUTTON_CLASS}`) || card.getAttribute(PROCESSED_ATTR) === mod.url) continue;
      const target = card;
      target.classList.add("nmp-preview-host", "nmp-search-card-host");
      card.setAttribute(PROCESSED_ATTR, mod.url);

      const button = createPreviewButton("nmp-search-preview-button");
      bindPreviewButton(button, mod, () => getTitle(card, `Mod ${mod.modId}`), card);
      target.append(button);
    }
  }

  function isSearchResultContext(node) {
    if (isNotificationContext(node)) return false;
    if (/\/search(?:[/?#]|$)/i.test(location.pathname)) return true;

    // Nexus renders the global search dialog in a portal on mod pages. In
    // that layout the result grid is not a descendant of the search input,
    // so ancestor-only detection misses every result. A non-empty search
    // field is a reliable signal that the portal is open; notification rows
    // are explicitly excluded below.
    const activeSearch = [...(document.querySelectorAll?.("input, [role='searchbox']") || [])]
      .some((input) => String(input.value || "").trim());
    if (activeSearch && !isNotificationContext(node)) return true;

    let current = node;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
      const signature = [
        current.id,
        current.className,
        current.getAttribute?.("data-testid"),
        current.getAttribute?.("aria-label")
      ].filter(Boolean).join(" ").replace(/\bnmp-[\w-]+/gi, "");
      if (/\bsearch\b|search[-_ ]?(?:result|item|card)/i.test(signature)) return true;
      if (/^search$/i.test(current.getAttribute?.("role") || "")) return true;
      if (
        /^dialog$/i.test(current.getAttribute?.("role") || "") &&
        current.querySelector?.("input, [role='searchbox']")
      ) return true;
      if (
        current !== document.body &&
        current !== document.documentElement &&
        current.querySelector?.("input, [role='searchbox']")
      ) return true;
      if (current.matches?.("body, html")) break;
    }
    // Some mod-page portals expose neither search semantics nor the input in
    // the same subtree. A bounded, card-shaped result with a Nexus mod link
    // is still an unambiguous preview target; notification rows were excluded
    // above before this fallback is considered.
    return Boolean(findResultCardFromImage(node));
  }

  function isNotificationContext(node) {
    let current = node;
    for (let depth = 0; current && depth < 12; depth += 1, current = current.parentElement) {
      const signature = [
        current.id,
        current.className,
        current.getAttribute?.("data-testid"),
        current.getAttribute?.("aria-label"),
        String(current.textContent || "").slice(0, 1200)
      ].filter(Boolean).join(" ").replace(/\bnmp-[\w-]+/gi, "");
      if (/\bnotifications?\b/i.test(signature)) return true;
      if (current.matches?.("body, html")) break;
    }
    return false;
  }

  function removeStaleSearchPreview(node) {
    const host = node.closest?.(".nmp-search-card-host");
    const button = host?.querySelector?.(".nmp-search-preview-button");
    if (!host || !button) return;
    button.remove();
    host.classList.remove("nmp-search-card-host", "nmp-preview-host");
    host.removeAttribute(PROCESSED_ATTR);
  }

  function findResultCardFromImage(image) {
    let node = image.parentElement;
    for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
      if (node.matches("body, html, header, nav")) break;
      if (!node.querySelector("a[href*='/mods/']")) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width >= 160 && rect.height >= 130 && rect.width <= 720 && rect.height <= 760) {
        return node;
      }
    }
    return null;
  }

  function injectMediaLinkButtons() {
    const anchors = [...document.querySelectorAll("a[href]")];
    for (const anchor of anchors) {
      if (anchor.closest(".nmp-modal, .nmp-lightbox")) continue;
      if (anchor.hasAttribute(MEDIA_LINK_PROCESSED_ATTR)) continue;

      const media = normalizeMediaUrl(anchor.href);
      if (!media || shouldIgnoreMediaLink(anchor, media)) continue;

      anchor.setAttribute(MEDIA_LINK_PROCESSED_ATTR, media.url);
      anchor.classList.add("nmp-inline-link");
      anchor.addEventListener("mouseenter", (event) => showLinkPopover(anchor, { type: "media", media }, event));
      anchor.addEventListener("focus", () => showLinkPopover(anchor, { type: "media", media }));
      anchor.addEventListener("mouseleave", scheduleLinkPopoverHide);
      anchor.addEventListener("blur", scheduleLinkPopoverHide);
    }
  }

  function injectProfileMediaButtons() {
    if (!/\/profile\/[^/]+\/media(?:\/|$)/i.test(location.pathname)) return;

    for (const image of document.querySelectorAll("img")) {
      if (image.closest("header, nav, .nmp-modal, .nmp-lightbox")) continue;
      const rect = image.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 110) continue;

      const anchor = image.closest("a[href]");
      if (!anchor || !/\/(?:images|videos|media)\//i.test(new URL(anchor.href, location.href).pathname)) continue;
      if (anchor.hasAttribute(PROFILE_MEDIA_PROCESSED_ATTR)) continue;

      const src = getProfileMediaImageUrl(image);
      if (!src) continue;

      anchor.setAttribute(PROFILE_MEDIA_PROCESSED_ATTR, "true");
      anchor.classList.add("nmp-preview-host");
      const button = createPreviewButton("nmp-profile-media-button");
      button.nmpProfileMedia = {
        type: "image",
        src,
        pageUrl: anchor.href,
        alt: image.alt?.trim() || "Profile media"
      };
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openProfileMediaPreview(button.nmpProfileMedia);
      });
      anchor.append(button);
    }
  }

  function getProfileMediaImageUrl(image) {
    const raw =
      image.getAttribute("data-full") ||
      image.getAttribute("data-original") ||
      image.getAttribute("data-src") ||
      image.currentSrc ||
      image.src;
    const src = absoluteUrl(raw, location.href);
    if (!src || !/\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(src)) return null;
    return src;
  }

  function getProfileMediaItems() {
    const seen = new Set();
    return [...document.querySelectorAll(".nmp-profile-media-button")]
      .map((button) => button.nmpProfileMedia)
      .filter((item) => {
        if (!item || seen.has(item.src)) return false;
        seen.add(item.src);
        return true;
      });
  }

  async function openProfileMediaPreview(selectedItem) {
    await settingsReady;
    ensureModal();
    state.activeCard = null;
    state.currentMod = null;
    state.title.textContent = selectedItem.alt || "Profile media";
    state.title.href = selectedItem.pageUrl || location.href;
    renderDownloadStatus(null);
    renderModMetaCards(null);
    renderDescription(null);
    renderRequirements(null);
    updateModNavigation();
    document.documentElement.classList.add("nmp-lock-scroll");
    state.modal.hidden = false;

    const items = getProfileMediaItems();
    const startIndex = Math.max(0, items.findIndex((item) => item.src === selectedItem.src));
    renderMedia(items, null, {
      profileMedia: true,
      profileUrl: location.href,
      startIndex
    });
  }

  async function openMediaLinkPreview(media, title, sourceElement) {
    await settingsReady;
    ensureModal();
    state.activeCard = sourceElement;
    state.currentMod = null;
    state.title.textContent = cleanTitle(title) || "Nexus media";
    state.title.href = media.url;
    renderDownloadStatus(null);
    renderModMetaCards(null);
    renderDescription(null);
    renderRequirements(null);
    updateModNavigation();
    state.body.innerHTML = `<div class="nmp-loading">Loading media...</div>`;
    document.documentElement.classList.add("nmp-lock-scroll");
    state.modal.hidden = false;

    try {
      const mediaItems = await getLinkedMedia(media, sourceElement);
      if (state.title.href === media.url) {
        renderMedia(mediaItems, null, {
          mediaPage: true,
          mediaPageUrl: media.url
        });
      }
    } catch (error) {
      state.body.innerHTML = `
        <div class="nmp-empty">
          <strong>Could not load media.</strong>
          <span>${escapeHtml(error.message || "Nexus Mods did not return readable media.")}</span>
          <a href="${escapeHtml(media.url)}" target="_self">Open on Nexus</a>
        </div>
      `;
    }
  }

  function injectInlineButton(anchor, mod) {
    if (anchor.getAttribute(INLINE_PROCESSED_ATTR) === mod.url) return;
    if (!anchor.textContent.trim()) return;

    anchor.setAttribute(INLINE_PROCESSED_ATTR, mod.url);
    anchor.classList.add("nmp-inline-link");
    anchor.addEventListener("mouseenter", (event) => showLinkPopover(anchor, { type: "mod", mod }, event));
    anchor.addEventListener("focus", () => showLinkPopover(anchor, { type: "mod", mod }));
    anchor.addEventListener("mouseleave", scheduleLinkPopoverHide);
    anchor.addEventListener("blur", scheduleLinkPopoverHide);
  }

  function shouldIgnoreInlineLink(anchor, mod) {
    const currentMod = normalizeModUrl(location.href);
    if (currentMod?.url === mod.url) return true;

    return Boolean(anchor.closest(
      "nav, [role='navigation'], [role='tablist'], [role='tab'], [class*='tab-nav'], [class*='tabs-nav'], [class*='mod-tabs']"
    ));
  }

  function shouldIgnoreMediaLink(anchor, media) {
    if (location.href.split("#")[0] === media.url) return true;
    if (
      anchor.classList.contains("nmp-preview-host") ||
      anchor.querySelector(`.${BUTTON_CLASS}`) ||
      anchor.closest(".nmp-preview-host")
    ) return true;
    return Boolean(anchor.closest(
      "nav, [role='navigation'], [role='tablist'], [role='tab'], [class*='tab-nav'], [class*='tabs-nav'], [class*='mod-tabs']"
    ));
  }

  function ensureLinkPopover() {
    if (state.linkPopover) return;

    const popover = document.createElement("div");
    popover.className = "nmp-link-popover";
    popover.hidden = true;
    popover.innerHTML = `
      <button class="nmp-link-popover-button" type="button" aria-label="Preview mod media" title="Preview media">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2.3l1.4-1.7c.3-.4.8-.6 1.3-.6h1c.5 0 1 .2 1.3.6L15.2 5h2.3A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10Z"/>
          <circle cx="12" cy="12.5" r="3.5"/>
        </svg>
        <span>Media</span>
      </button>
    `;

    popover.addEventListener("mouseenter", cancelLinkPopoverHide);
    popover.addEventListener("mouseleave", scheduleLinkPopoverHide);

    state.linkPopoverButton = popover.querySelector("button");
    state.linkPopoverButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!state.activeInlineLink || !state.activeLinkPreview) return;
      if (state.activeLinkPreview.type === "mod") {
        const mod = state.activeLinkPreview.mod;
        openConfiguredPreview(
          mod,
          getInlineTitle(state.activeInlineLink, `Mod ${mod.modId}`),
          state.activeInlineLink
        );
      } else if (state.activeLinkPreview.type === "media") {
        openMediaLinkPreview(
          state.activeLinkPreview.media,
          getInlineTitle(state.activeInlineLink, "Nexus media"),
          state.activeInlineLink
        );
      }
      hideLinkPopover();
    });

    document.body.append(popover);
    state.linkPopover = popover;
  }

  function showLinkPopover(anchor, preview, event = null) {
    if (
      preview.type === "mod" && shouldIgnoreInlineLink(anchor, preview.mod) ||
      preview.type === "media" && shouldIgnoreMediaLink(anchor, preview.media)
    ) {
      hideLinkPopover();
      return;
    }

    ensureLinkPopover();
    cancelLinkPopoverHide();

    state.activeInlineLink = anchor;
    state.activeLinkPreview = preview;

    const rect = getAnchorInteractionRect(anchor, event);
    const popover = state.linkPopover;
    popover.hidden = false;

    const margin = 8;
    const top = Math.max(margin, rect.top + rect.height / 2 - popover.offsetHeight / 2);
    const preferredLeft = rect.right + margin;
    const left = preferredLeft + popover.offsetWidth < window.innerWidth - margin
      ? preferredLeft
      : Math.max(margin, rect.left - popover.offsetWidth - margin);

    popover.style.left = `${left}px`;
    popover.style.top = `${Math.min(top, window.innerHeight - popover.offsetHeight - margin)}px`;
  }

  function getAnchorInteractionRect(anchor, event) {
    if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
      return {
        left: event.clientX,
        right: event.clientX,
        top: event.clientY - 12,
        height: 24
      };
    }

    const textRect = getFirstTextRect(anchor);
    return textRect || anchor.getBoundingClientRect();
  }

  function getFirstTextRect(anchor) {
    const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const textNode = walker.nextNode();
    if (!textNode) return null;

    const range = document.createRange();
    range.selectNodeContents(textNode);
    const rect = [...range.getClientRects()].find((item) => item.width > 0 && item.height > 0) || null;
    range.detach();
    return rect;
  }

  function scheduleLinkPopoverHide() {
    cancelLinkPopoverHide();
    state.linkPopoverTimer = window.setTimeout(hideLinkPopover, 220);
  }

  function cancelLinkPopoverHide() {
    if (!state.linkPopoverTimer) return;
    window.clearTimeout(state.linkPopoverTimer);
    state.linkPopoverTimer = null;
  }

  function hideLinkPopover() {
    cancelLinkPopoverHide();
    if (state.linkPopover) state.linkPopover.hidden = true;
    state.activeInlineLink = null;
    state.activeLinkPreview = null;
  }

  function createPreviewButton(extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = [BUTTON_CLASS, extraClass].filter(Boolean).join(" ");
    button.title = "Preview media";
    button.setAttribute("aria-label", "Preview mod media");
    button.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2.3l1.4-1.7c.3-.4.8-.6 1.3-.6h1c.5 0 1 .2 1.3.6L15.2 5h2.3A2.5 2.5 0 0 1 20 7.5v10A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-10Z"/>
        <circle cx="12" cy="12.5" r="3.5"/>
      </svg>
    `;
    return button;
  }

  function bindPreviewButton(button, mod, getButtonTitle, sourceElement) {
    button.nmpEntry = { mod, getTitle: getButtonTitle, sourceElement };
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openConfiguredPreview(mod, getButtonTitle(), sourceElement);
    });
  }

  function openConfiguredPreview(mod, title, sourceElement) {
    if (userSettings.openMode === "new-tab") {
      window.open(mod.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (userSettings.openMode === "same-tab") {
      window.location.href = mod.url;
      return;
    }
    openPreview(mod, title, sourceElement);
  }

  function getNavigableEntries() {
    const seen = new Set();
    const buttonEntries = [...document.querySelectorAll(`.${BUTTON_CLASS}`)]
      .map((button) => button.nmpEntry)
      .filter(Boolean);
    const linkEntries = [...document.querySelectorAll(`a[${INLINE_PROCESSED_ATTR}]`)]
      .map((anchor) => {
        const mod = normalizeModUrl(anchor.href);
        return mod ? {
          mod,
          getTitle: () => getInlineTitle(anchor, `Mod ${mod.modId}`),
          sourceElement: anchor
        } : null;
      })
      .filter(Boolean);

    return [...buttonEntries, ...linkEntries].filter((entry) => {
      if (!entry?.sourceElement?.isConnected || seen.has(entry.mod.url)) return false;
      seen.add(entry.mod.url);
      return true;
    });
  }

  function updateModNavigation() {
    const entries = getNavigableEntries();
    const currentIndex = entries.findIndex((entry) => entry.mod.url === state.currentMod?.url);
    const unavailable = entries.length < 2 || currentIndex < 0;
    if (state.previousModButton) state.previousModButton.disabled = unavailable;
    if (state.nextModButton) state.nextModButton.disabled = unavailable;
  }

  function navigateMod(direction) {
    const entries = getNavigableEntries();
    const currentIndex = entries.findIndex((entry) => entry.mod.url === state.currentMod?.url);
    if (entries.length < 2 || currentIndex < 0) return;

    const nextIndex = (currentIndex + direction + entries.length) % entries.length;
    const entry = entries[nextIndex];
    openPreview(entry.mod, entry.getTitle(), entry.sourceElement);
  }

  function getInlineTitle(anchor, fallback) {
    return (anchor.textContent || anchor.getAttribute("title") || fallback).trim().replace(/\s+/g, " ");
  }

  async function openPreview(mod, title, card) {
    await settingsReady;
    ensureModal();
    state.activeCard = card;
    state.currentMod = mod;
    state.title.textContent = cleanTitle(title) || `Mod ${mod.modId}`;
    state.title.href = mod.url;
    renderDownloadStatus(null);
    renderModMetaCards(null);
    renderDescription(null);
    renderRequirements(null);
    updateModNavigation();
    state.body.innerHTML = `<div class="nmp-loading">Loading media...</div>`;
    document.documentElement.classList.add("nmp-lock-scroll");
    state.modal.hidden = false;

    getCanonicalModMeta(mod).then((meta) => {
      if (state.currentMod?.url === mod.url) {
        state.title.textContent = meta.title;
        renderDescription(meta.summary);
        renderRequirements(meta.requirements);
        renderModMetaCards(meta);
        if (meta.downloadInfo) renderDownloadStatus(meta.downloadInfo);
      }
    }).catch(() => null);

    try {
      const media = await getMedia(mod);
      renderMedia(media, mod);
    } catch (error) {
      state.body.innerHTML = `
        <div class="nmp-empty">
          <strong>Could not load media.</strong>
          <span>${escapeHtml(error.message || "Nexus Mods did not return a readable media page.")}</span>
          <a href="${mod.url}?tab=images" target="_blank" rel="noreferrer">Open media tab</a>
        </div>
      `;
    }
  }

  async function getCanonicalModMeta(mod) {
    if (modMetaCache.has(mod.url)) return modMetaCache.get(mod.url);

    const promise = Promise.allSettled([
      fetchPageHtml(mod.url),
      fetchPageHtml(`${mod.url}?tab=description`)
    ]).then((results) => {
      const documents = results
        .filter((result) => result.status === "fulfilled")
        .map((result) => new DOMParser().parseFromString(result.value, "text/html"));
      if (!documents.length) throw new Error("The mod page could not be loaded.");

      const titles = documents.map((doc) => cleanTitle(
        doc.querySelector("meta[property='og:title']")?.content ||
        doc.querySelector("h1")?.textContent ||
        doc.title
      )).filter(Boolean);
      const title = titles[0] || cleanTitle(mod.url);
      if (!title) throw new Error("The mod title was not found.");

      const firstValue = (read) => documents.map((doc) => readMetadataField(() => read(doc))).find(Boolean) || null;
      const requirements = documents
        .map((doc) => readMetadataField(() => extractModRequirements(doc)) || [])
        .flat()
        .filter((requirement, index, all) => requirement?.url && all.findIndex((item) => item.url === requirement.url) === index);

      return {
        title,
        summary: firstValue((doc) => descriptionApi.extract(doc, title)),
        downloadInfo: firstValue((doc) => readStrictDownloadHistory(doc)),
        requirements: requirements.length ? requirements : null,
        author: firstValue((doc) => extractModAuthor(doc)),
        totalDownloads: firstValue((doc) => extractTotalDownloads(doc))
      };
    });

    modMetaCache.set(mod.url, promise);
    promise.catch(() => modMetaCache.delete(mod.url));
    return promise;
  }

  function fetchPageHtml(url) {
    if (pageHtmlCache.has(url)) return pageHtmlCache.get(url);

    const promise = fetch(url, { credentials: "include" }).then((response) => {
      if (!response.ok) throw new Error(`Nexus page request failed: ${response.status}`);
      return response.text();
    });

    pageHtmlCache.set(url, promise);
    promise.catch(() => pageHtmlCache.delete(url));
    return promise;
  }

  function readMetadataField(read) {
    try {
      return read();
    } catch {
      return null;
    }
  }

  function extractModAuthor(doc) {
    for (const label of ["Uploaded by", "Created by"]) {
      const author = extractNexusLabeledAuthor(doc, label);
      if (author) return author;
    }
    return null;
  }

  function extractNexusLabeledAuthor(doc, label) {
    const labelRe = new RegExp(`^${label}$`, "i");
    const nodes = [...doc.querySelectorAll("dt, th, strong, b, span, div, p, h3, h4")];
    for (const node of nodes) {
      if (node.closest("header, nav, [role='navigation']")) continue;
      const nodeText = cleanText(node.textContent);
      if (nodeText.length > 140) continue;
      if (!labelRe.test(nodeText) && !new RegExp(`^${label}\\b`, "i").test(nodeText)) continue;

      const author = authorFromLabelNode(node, label);
      if (author) return author;
    }

    const text = cleanText(doc.body?.textContent || "");
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`\\b${escaped}\\s+(.+?)(?=\\s+(?:Virus scan|Tags for this mod|Last updated|Original upload|Created by|Uploaded by|About this mod)\\b|$)`, "i"));
    const name = normalizeAuthorName(match?.[1]);
    return name ? {
      name,
      url: profileUrlForName(name)
    } : null;
  }

  function authorFromLabelNode(node, label) {
    const sameNodeValue = normalizeAuthorName(cleanText(node.textContent).replace(new RegExp(`^${label}\\b\\s*`, "i"), ""));
    if (sameNodeValue) {
      const link = node.matches("a[href*='/profile/']") ? node : node.querySelector("a[href*='/profile/']");
      return {
        name: sameNodeValue,
        url: absoluteUrl(link?.getAttribute("href"), location.href) || profileUrlForName(sameNodeValue)
      };
    }

    const candidates = [
      node.nextElementSibling,
      node.parentElement,
      node.closest("li, dl, tr, .stat, [class*='stat'], [class*='meta'], [class*='detail'], [class*='info']")
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (candidate.closest?.("header, nav, [role='navigation']")) continue;
      const link = candidate.matches?.("a[href*='/profile/']") ? candidate : candidate.querySelector?.("a[href*='/profile/']");
      const raw = link ? cleanText(link.textContent) : cleanText(candidate.textContent).replace(new RegExp(`^${label}\\b\\s*`, "i"), "");
      const name = normalizeAuthorName(raw);
      if (name) {
        return {
          name,
          url: absoluteUrl(link?.getAttribute("href"), location.href) || profileUrlForName(name)
        };
      }
    }
    return null;
  }

  function normalizeAuthorName(value) {
    const name = cleanText(value)
      .replace(/^(?:by|author:)\s+/i, "")
      .replace(/\s+(?:Virus scan|Tags for this mod|Last updated|Original upload|Created by|Uploaded by).*$/i, "")
      .trim();
    if (!name || name.length > 48) return "";
    if (!/^[\w .'-]+$/.test(name)) return "";
    return name;
  }

  function profileUrlForName(name) {
    return `https://www.nexusmods.com/profile/${encodeURIComponent(name)}`;
  }

  function extractTotalDownloads(doc) {
    const text = cleanText(doc.body?.textContent || "");
    const match = text.match(/\bTotal\s+(?:DLs|downloads)\s*([0-9][0-9,.\s]*(?:[kKmM])?)/i);
    if (!match) return null;
    return normalizeStatValue(match[1]);
  }

  function normalizeStatValue(value) {
    return String(value || "").replace(/\s+/g, "").replace(/,/g, ",").trim();
  }

  function extractModRequirements(doc) {
    return requirementsApi.extract(doc, normalizeModUrl);
  }

  function readStrictDownloadHistory(root) {
    const text = root?.body?.textContent || root?.documentElement?.textContent || "";
    const match = text.match(
      /you\s+last\s+downloaded\s+a\s+file\s+from\s+this\s+mod\s+on\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i
    );
    if (!match) return null;

    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
      .indexOf(match[2].slice(0, 3).toLowerCase());
    if (month < 0) return null;

    return {
      downloaded: true,
      date: new Date(Number(match[3]), month, Number(match[1]), 12)
    };
  }

  function cleanTitle(value) {
    return String(value || "")
      .replace(/\s+at\s+.+?\s+Nexus\s+-\s+Mods.*$/i, "")
      .replace(/\s+(?:at|on)\s+Nexus Mods.*$/i, "")
      .replace(/\s+-\s+Nexus Mods.*$/i, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function cleanText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  async function getMedia(mod) {
    if (mediaCache.has(mod.url)) return mediaCache.get(mod.url);

    const urls = [
      `${mod.url}?tab=images`,
      `${mod.url}?tab=videos`,
      mod.url
    ];

    const pages = await Promise.all(urls.map(async (url) => {
      try {
        return { url, html: await fetchPageHtml(url) };
      } catch {
        return null;
      }
    }));
    const collected = pages
      .filter(Boolean)
      .flatMap(({ html, url }) => parseMedia(html, url, mod));

    const unique = dedupeMedia(collected);
    const images = unique.filter((item) => item.type === "image").slice(0, 40);
    const otherMedia = unique.filter((item) => item.type !== "image").slice(0, 12);
    const result = [...images, ...otherMedia];
    mediaCache.set(mod.url, result);
    return result;
  }

  async function getLinkedMedia(media, sourceElement) {
    if (mediaCache.has(media.url)) return mediaCache.get(media.url);

    const fromSource = extractSourceElementMedia(sourceElement, media.url);
    let fromPage = [];
    try {
      fromPage = parseLinkedMedia(await fetchPageHtml(media.url), media.url);
    } catch {
      // Keep any media already visible on the current page.
    }

    const result = dedupeMedia([...fromSource, ...fromPage]).slice(0, 24);
    if (!result.length) throw new Error("No readable media was found for this link.");
    mediaCache.set(media.url, result);
    return result;
  }

  function extractSourceElementMedia(sourceElement, pageUrl) {
    const image = sourceElement?.querySelector?.("img") || sourceElement?.closest?.("a[href]")?.querySelector?.("img");
    const src = image ? cleanStandaloneImageUrl(
      image.getAttribute("data-full") ||
      image.getAttribute("data-original") ||
      image.getAttribute("data-src") ||
      image.currentSrc ||
      image.src,
      location.href
    ) : null;

    return src ? [{
      type: "image",
      src,
      alt: image.getAttribute("alt") || sourceElement.textContent?.trim() || "Nexus media",
      pageUrl
    }] : [];
  }

  function parseLinkedMedia(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = [];

    const metaImage =
      doc.querySelector("meta[property='og:image']")?.content ||
      doc.querySelector("meta[name='twitter:image']")?.content;
    const metaImageUrl = cleanStandaloneImageUrl(metaImage, baseUrl);
    if (metaImageUrl) {
      items.push({
        type: "image",
        src: metaImageUrl,
        alt: cleanTitle(doc.querySelector("meta[property='og:title']")?.content || doc.title) || "Nexus media",
        pageUrl: baseUrl
      });
    }

    for (const node of doc.querySelectorAll("img, [data-src], [data-original], [data-full], [data-image], [data-background-image]")) {
      const raw =
        node.getAttribute("data-full") ||
        node.getAttribute("data-original") ||
        node.getAttribute("data-src") ||
        node.getAttribute("data-image") ||
        node.getAttribute("data-background-image") ||
        node.getAttribute("srcset")?.split(",").pop()?.trim().split(/\s+/)[0] ||
        node.getAttribute("src");
      const src = cleanStandaloneImageUrl(raw, baseUrl);
      if (!src) continue;
      items.push({
        type: "image",
        src,
        alt: node.getAttribute("alt") || "Nexus media",
        pageUrl: baseUrl
      });
    }

    for (const anchor of doc.querySelectorAll("a[href]")) {
      const href = absoluteUrl(anchor.getAttribute("href"), baseUrl);
      const videoId = extractYouTubeId(href);
      if (videoId) {
        items.push({
          type: "video",
          src: getYouTubeEmbedUrl(videoId),
          label: getVideoLabel(anchor),
          pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
          videoId
        });
      }
    }

    for (const iframe of doc.querySelectorAll("iframe[src], iframe[data-src], iframe[data-lazy-src]")) {
      const src = iframe.getAttribute("src") || iframe.getAttribute("data-src") || iframe.getAttribute("data-lazy-src");
      const videoId = extractYouTubeId(src);
      if (!videoId) continue;
      items.push({
        type: "video",
        src: getYouTubeEmbedUrl(videoId),
        label: getVideoLabel(iframe),
        pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoId
      });
    }

    return items;
  }

  function parseMedia(html, baseUrl, mod) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const items = [];

    const imageCandidates = [
      ...doc.querySelectorAll("img"),
      ...doc.querySelectorAll("[data-src], [data-original], [data-full], [data-image], [data-background-image]")
    ];

    for (const node of imageCandidates) {
      const raw =
        node.getAttribute("data-full") ||
        node.getAttribute("data-original") ||
        node.getAttribute("data-src") ||
        node.getAttribute("data-image") ||
        node.getAttribute("data-background-image") ||
        node.getAttribute("srcset")?.split(",").pop()?.trim().split(/\s+/)[0] ||
        node.getAttribute("src");
      const src = cleanImageUrl(raw, baseUrl, mod);
      if (src) {
        items.push({
          type: "image",
          src,
          alt: node.getAttribute("alt") || "Mod media",
          pageUrl: getClosestMediaPageUrl(node, baseUrl, mod)
        });
      }
    }

    for (const anchor of doc.querySelectorAll("a[href]")) {
      const href = absoluteUrl(anchor.getAttribute("href"), baseUrl);
      if (!href) continue;

      if (/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(href) || href.includes("staticdelivery.nexusmods.com")) {
        const src = cleanImageUrl(href, baseUrl, mod);
        if (src) {
          items.push({
            type: "image",
            src,
            alt: anchor.textContent.trim() || "Mod media",
            pageUrl: getMediaPageUrl(anchor, href, baseUrl, mod)
          });
        }
      }

      const videoId = extractYouTubeId(href);
      if (videoId) {
        items.push({
          type: "video",
          src: getYouTubeEmbedUrl(videoId),
          label: getVideoLabel(anchor),
          pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
          videoId
        });
      } else if (/vimeo\.com/i.test(href)) {
        items.push({
          type: "link",
          src: href,
          label: anchor.textContent.trim() || "Open video"
        });
      }
    }

    for (const iframe of doc.querySelectorAll("iframe[src], iframe[data-src], iframe[data-lazy-src]")) {
      const src = iframe.getAttribute("src") || iframe.getAttribute("data-src") || iframe.getAttribute("data-lazy-src");
      const videoId = extractYouTubeId(src);
      if (videoId) {
        items.push({
          type: "video",
          src: getYouTubeEmbedUrl(videoId),
          label: getVideoLabel(iframe),
          pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
          videoId
        });
      }
    }

    for (const node of doc.querySelectorAll("[data-youtube-id], [data-video-id], [data-video-url]")) {
      const raw = node.getAttribute("data-youtube-id") || node.getAttribute("data-video-id") || node.getAttribute("data-video-url");
      const videoId = /^[a-zA-Z0-9_-]{11}$/.test(raw || "") ? raw : extractYouTubeId(raw);
      if (!videoId) continue;
      items.push({
        type: "video",
        src: getYouTubeEmbedUrl(videoId),
        label: getVideoLabel(node),
        pageUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoId
      });
    }

    return items.filter((item) => {
      if (item.type !== "image") return true;
      return isModMediaImage(item.src, mod);
    });
  }

  function extractYouTubeId(url) {
    if (!url) return null;
    const validId = (value) => /^[a-zA-Z0-9_-]{11}$/.test(value || "") ? value : null;
    try {
      const parsed = new URL(url, location.href);
      const host = parsed.hostname.replace(/^www\./, "");
      if (host === "youtu.be") return validId(parsed.pathname.split("/").filter(Boolean)[0]);
      if (host === "youtube.com" || host === "youtube-nocookie.com") {
        const queryId = parsed.searchParams.get("v");
        if (queryId) return validId(queryId);
        const match = parsed.pathname.match(/\/(?:embed|v|shorts|live)\/([a-zA-Z0-9_-]{11})/);
        if (match) return validId(match[1]);
      }
    } catch {
      return null;
    }
    return null;
  }

  function getYouTubeEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  function getVideoLabel(node) {
    return cleanTitle(
      node.getAttribute?.("title") ||
      node.getAttribute?.("aria-label") ||
      node.querySelector?.("img[alt]")?.getAttribute("alt") ||
      node.textContent
    ) || "YouTube video";
  }

  function cleanImageUrl(raw, baseUrl, mod) {
    const src = absoluteUrl(raw, baseUrl);
    if (!src) return null;
    if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(src) && !src.includes("staticdelivery.nexusmods.com")) return null;
    const cleaned = src
      .replace(/\/thumbnails\//i, "/")
      .replace(/\/thumbs\//i, "/")
      .replace(/(\?[^#]*)?$/, "");
    return isModMediaImage(cleaned, mod) ? cleaned : null;
  }

  function cleanStandaloneImageUrl(raw, baseUrl) {
    const src = absoluteUrl(raw, baseUrl);
    if (!src) return null;
    if (!/\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(src) && !src.includes("staticdelivery.nexusmods.com")) return null;

    const cleaned = src
      .replace(/\/thumbnails\//i, "/")
      .replace(/\/thumbs\//i, "/")
      .replace(/(\?[^#]*)?$/, "");

    return isStandaloneMediaImage(cleaned) ? cleaned : null;
  }

  function isStandaloneMediaImage(src) {
    const blockedPatterns = [
      /\/images\/News\//i,
      /\/images\/games\//i,
      /\/images\/collections\//i,
      /\/images\/site\//i,
      /\/(avatars|users|user|icons|badges|logos)\//i,
      /[?&](size|avatar)=/i
    ];

    if (blockedPatterns.some((pattern) => pattern.test(src))) return false;

    try {
      const url = new URL(src);
      if (url.hostname === "staticdelivery.nexusmods.com") {
        return /\/(?:mods|images)\//i.test(url.pathname);
      }
      return url.hostname === "www.nexusmods.com" && /\/(?:images|media)\//i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function isModMediaImage(src, mod) {
    if (!src) return false;

    const blockedPatterns = [
      /\/images\/News\//i,
      /\/images\/games\//i,
      /\/images\/collections\//i,
      /\/images\/site\//i,
      /\/(avatars|users|user|icons|badges|logos)\//i,
      /[?&](size|avatar)=/i
    ];

    if (blockedPatterns.some((pattern) => pattern.test(src))) return false;

    try {
      const url = new URL(src);
      const path = url.pathname;

      if (url.hostname === "staticdelivery.nexusmods.com") {
        return (
          new RegExp(`/mods/\\d+/images/${mod.modId}(?:/|[-_])`, "i").test(path) ||
          new RegExp(`/mods/\\d+/thumbnails/${mod.modId}(?:/|[-_])`, "i").test(path) ||
          new RegExp(`/images/${mod.modId}(?:/|[-_])`, "i").test(path)
        );
      }

      return (
        url.hostname === "www.nexusmods.com" &&
        path.toLowerCase().includes(`/${mod.game.toLowerCase()}/mods/${mod.modId}/`) &&
        /\/images\//i.test(path)
      );
    } catch {
      return false;
    }
  }

  function absoluteUrl(raw, baseUrl) {
    if (!raw || raw.startsWith("data:")) return null;
    try {
      return new URL(raw, baseUrl).href;
    } catch {
      return null;
    }
  }

  function dedupeMedia(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
      const key = `${item.type}:${item.src}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  function renderMedia(media, mod, options = {}) {
    state.currentMedia = [];
    state.currentMod = mod;
    state.profileMediaMode = Boolean(options.profileMedia);
    state.currentIndex = 0;

    const fallbackLink = mod
      ? `<a href="${mod.url}?tab=images" target="_blank" rel="noreferrer">Open media tab</a>`
      : options.mediaPageUrl
        ? `<a href="${escapeHtml(options.mediaPageUrl)}" target="_self">Open on Nexus</a>`
        : "";

    if (!media.length) {
      state.body.innerHTML = `
        <div class="nmp-empty">
          <strong>No media found on this card.</strong>
          <span>The media page might require a different layout or an age/session prompt.</span>
          ${fallbackLink}
        </div>
      `;
      return;
    }

    const images = media.filter((item) => item.type === "image");
    const videos = userSettings.showYoutube ? media.filter((item) => item.type === "video") : [];
    const links = userSettings.showNexusVideos ? media.filter((item) => item.type === "link") : [];
    state.currentMedia = images;
    state.currentMod = mod;
    state.currentIndex = Math.min(Math.max(options.startIndex || 0, 0), Math.max(images.length - 1, 0));

    const videoSection = videos.length ? `
      <div class="nmp-video-section">
        <div class="nmp-video-heading">
          <span class="nmp-video-badge">YouTube</span>
          <span>${videos.length} ${videos.length === 1 ? "video" : "videos"}</span>
        </div>
        ${videos.map((v) => `
          <article class="nmp-video-item">
            <div class="nmp-video-title">
              <span>${escapeHtml(v.label)}</span>
              <a href="${escapeHtml(v.pageUrl)}" target="_blank" rel="noreferrer">Open on YouTube</a>
            </div>
            <iframe
              src="${escapeHtml(v.src)}"
              title="${escapeHtml(v.label)}"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </article>
        `).join("")}
      </div>
    ` : "";
    const nexusVideoSection = links.length ? `
      <div class="nmp-video-section nmp-nexus-video-section">
        <div class="nmp-video-heading">
          <span class="nmp-video-badge">Nexus</span>
          <span>${links.length} ${links.length === 1 ? "video" : "videos"}</span>
        </div>
        <div class="nmp-nexus-video-links">
          ${links.map((item) => `<a href="${escapeHtml(item.src)}" target="_blank" rel="noreferrer">${escapeHtml(item.label || "Open Nexus video")}</a>`).join("")}
        </div>
      </div>
    ` : "";

    if (!images.length) {
      state.body.innerHTML = `
        <div class="nmp-gallery-shell">
          <div class="nmp-empty">
            <strong>No images found.</strong>
            <span>${mod ? "This mod has no images, but may have videos below." : "This media link has no image, but may have videos below."}</span>
            ${fallbackLink}
          </div>
          ${videoSection}${nexusVideoSection}
        </div>
      `;
      return;
    }

    state.body.innerHTML = `
      <div class="nmp-gallery-shell">
        <div class="nmp-gallery-main">
          ${userSettings.showActionButtons ? `<div class="nmp-image-actions" aria-label="Image actions">
            <button type="button" data-nmp-action="copy-image" aria-label="Copy image" title="Copy image">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 8h10v12H8z"/><path d="M6 16H4V4h12v2"/></svg>
            </button>
            <button type="button" data-nmp-action="download-image" aria-label="Download image" title="Download image">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
            </button>
            <button type="button" data-nmp-action="open-image-tab" aria-label="Open image in a new tab" title="Open image in a new tab">
              <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="m10 14 10-10"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg>
            </button>
            <span class="nmp-action-status" role="status" aria-live="polite"></span>
          </div>` : ""}
          <button class="nmp-nav nmp-nav-prev" type="button" data-nmp-action="prev" aria-label="Previous media">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button class="nmp-stage" type="button" data-nmp-action="open" aria-label="Open zoomed view">
            <img src="" alt="">
          </button>
          <button class="nmp-nav nmp-nav-next" type="button" data-nmp-action="next" aria-label="Next media">
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
          </button>
        </div>
        <div class="nmp-gallery-footer">
          <div class="nmp-counter"></div>
          <div class="nmp-toolbar">
            <button type="button" data-nmp-action="open-nexus">Open on Nexus</button>
            ${renderMediaToolbarLinks(mod, options, videos, links)}
          </div>
        </div>
        <div class="nmp-thumbs" aria-label="Media thumbnails">
          ${images.map((item, index) => `
            <button class="nmp-thumb" type="button" data-nmp-index="${index}" aria-label="Show media ${index + 1}">
              <img src="${item.src}" alt="${escapeHtml(item.alt)}" loading="lazy">
            </button>
          `).join("")}
        </div>
        ${videoSection}${nexusVideoSection}
      </div>
    `;

    state.body.onclick = handleGalleryClick;
    updateGallery();
  }

  function renderMediaToolbarLinks(mod, options, videos, links) {
    if (options.profileMedia) {
      return `<a href="${escapeHtml(options.profileUrl || location.href)}" target="_self">Profile media</a>`;
    }

    if (mod) {
      return `<a href="${mod.url}?tab=images" target="_self">All media</a>
        ${videos.length || links.length ? `<a href="${mod.url}?tab=videos" target="_self">Videos</a>` : ""}`;
    }

    if (options.mediaPageUrl) {
      return `<a href="${escapeHtml(options.mediaPageUrl)}" target="_self">Media page</a>`;
    }

    return "";
  }

  function handleGalleryClick(event) {
    const thumb = event.target.closest("[data-nmp-index]");
    if (thumb) {
      state.currentIndex = Number(thumb.dataset.nmpIndex) || 0;
      updateGallery();
      return;
    }

    const action = event.target.closest("[data-nmp-action]")?.dataset.nmpAction;
    if (!action) return;

    if (action === "prev") {
      moveGallery(-1);
    } else if (action === "next") {
      moveGallery(1);
    } else if (action === "open") {
      const item = state.currentMedia[state.currentIndex];
      if (item?.type === "image") {
        openLightbox(item.src, item.alt);
      }
    } else if (action === "open-nexus") {
      openCurrentMediaOnNexus();
    } else if (action === "copy-image") {
      copyCurrentImage();
    } else if (action === "download-image") {
      downloadCurrentImage();
    } else if (action === "open-image-tab") {
      openCurrentImageInNewTab();
    }
  }

  function moveGallery(direction) {
    if (!state.currentMedia.length) return;
    state.currentIndex = (state.currentIndex + direction + state.currentMedia.length) % state.currentMedia.length;
    updateGallery();
  }

  function updateGallery() {
    const item = state.currentMedia[state.currentIndex];
    if (!item || !state.body) return;

    const stageImage = state.body.querySelector(".nmp-stage img");
    const counter = state.body.querySelector(".nmp-counter");

    if (stageImage) {
      stageImage.src = item.src;
      stageImage.alt = item.alt || "Mod media";
    }

    if (counter) {
      counter.textContent = `${state.currentIndex + 1} / ${state.currentMedia.length}`;
    }

    if (state.profileMediaMode) {
      state.title.textContent = item.alt || "Profile media";
      state.title.href = item.pageUrl || location.href;
    }

    for (const thumb of state.body.querySelectorAll(".nmp-thumb")) {
      thumb.classList.toggle("is-active", Number(thumb.dataset.nmpIndex) === state.currentIndex);
    }

    prepareClipboardBlob(item.src).catch(() => {});
  }

  function openCurrentMediaOnNexus() {
    const item = state.currentMedia[state.currentIndex];
    if (!item) return;
    const target = item.pageUrl || (state.currentMod ? `${state.currentMod.url}?tab=images` : null);
    if (target) window.location.href = target;
  }

  async function copyCurrentImage() {
    const item = state.currentMedia[state.currentIndex];
    if (!item || item.type !== "image") return;

    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard image copy is not available in this browser.");
      }

      const blob = await prepareClipboardBlob(item.src);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob })
      ]);
      setActionStatus("Image copied");
    } catch (error) {
      setActionStatus("Copy blocked");
      console.warn("[Nexus Media Preview] Could not copy image:", error);
    }
  }

  async function downloadCurrentImage() {
    const item = state.currentMedia[state.currentIndex];
    if (!item || item.type !== "image") return;

    try {
      const result = await sendExtensionMessage({
        type: "nmp-download-image",
        url: item.src,
        filename: getImageFilename(item.src)
      });
      if (!result?.ok) throw new Error(result?.error || "The browser rejected the download.");
      setActionStatus("Download started");
    } catch (error) {
      setActionStatus("Download failed");
      console.warn("[Nexus Media Preview] Could not download image:", error);
    }
  }

  function openCurrentImageInNewTab() {
    const item = state.currentMedia[state.currentIndex];
    if (!item || item.type !== "image") return;
    window.open(item.src, "_blank", "noopener,noreferrer");
    setActionStatus("Opened");
  }

  function prepareClipboardBlob(src) {
    if (!clipboardBlobCache.has(src)) {
      const promise = fetchImageBlobThroughExtension(src).then(convertBlobToPng);
      clipboardBlobCache.set(src, promise);
      promise.catch(() => clipboardBlobCache.delete(src));
    }
    return clipboardBlobCache.get(src);
  }

  async function fetchImageBlobThroughExtension(src) {
    const result = await sendExtensionMessage({ type: "nmp-fetch-image", url: src });
    if (!result?.ok) throw new Error(result?.error || "The extension could not retrieve the image.");

    const binary = atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: result.type });
  }

  async function convertBlobToPng(blob) {
    if (blob.type === "image/png") return blob;

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (pngBlob) => pngBlob ? resolve(pngBlob) : reject(new Error("PNG conversion failed.")),
        "image/png"
      );
    });
  }

  function sendExtensionMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(response);
      });
    });
  }

  function getImageFilename(src, mimeType = "") {
    try {
      const url = new URL(src);
      const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
      if (/\.(jpg|jpeg|png|webp)$/i.test(name)) return sanitizeFilename(name);
    } catch {
      // Fall through to generated name.
    }

    const extension = mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
        ? "webp"
        : "jpg";
    const modId = state.currentMod?.modId || "mod";
    return `nexus-${modId}-${state.currentIndex + 1}.${extension}`;
  }

  function sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/[. ]+$/g, "")
      .slice(0, 180) || `nexus-${state.currentMod?.modId || "mod"}-${state.currentIndex + 1}.jpg`;
  }

  function setActionStatus(message) {
    const status = state.body?.querySelector(".nmp-action-status");
    if (!status) return;
    status.textContent = message;
    status.classList.add("is-visible");
    window.clearTimeout(setActionStatus.timer);
    setActionStatus.timer = window.setTimeout(() => {
      status.classList.remove("is-visible");
      status.textContent = "";
    }, 1600);
  }

  function getClosestMediaPageUrl(node, baseUrl, mod) {
    const anchor = node.closest("a[href]");
    if (!anchor) return null;
    return getMediaPageUrl(anchor, anchor.getAttribute("href"), baseUrl, mod);
  }

  function getMediaPageUrl(anchor, href, baseUrl, mod) {
    const url = absoluteUrl(href, baseUrl);
    if (!url) return `${mod.url}?tab=images`;

    try {
      const parsed = new URL(url);
      if (parsed.hostname === "www.nexusmods.com" && /\/mods\/\d+/i.test(parsed.pathname)) return parsed.href;
      if (parsed.hostname === "staticdelivery.nexusmods.com") {
        const imageId = extractImageId(url, mod);
        return imageId ? `${mod.url}?tab=images&image=${encodeURIComponent(imageId)}` : `${mod.url}?tab=images`;
      }
    } catch {
      return `${mod.url}?tab=images`;
    }

    const imageId = extractImageId(url, mod);
    return imageId ? `${mod.url}?tab=images&image=${encodeURIComponent(imageId)}` : `${mod.url}?tab=images`;
  }

  function extractImageId(src, mod) {
    const match = src.match(new RegExp(`${mod.modId}[-_](\\d+)`, "i"));
    if (match) return match[1];
    const fallback = src.match(/\/images\/\d+\/(\d+)[-_]/i);
    return fallback ? fallback[1] : null;
  }

  function ensureLightbox() {
    if (state.lightbox) return;

    const lightbox = document.createElement("div");
    lightbox.className = "nmp-lightbox";
    lightbox.hidden = true;
    lightbox.innerHTML = `
      <div class="nmp-lightbox-backdrop" data-nmp-lightbox-close></div>
      <div class="nmp-lightbox-toolbar" aria-label="Image zoom controls">
        <button type="button" data-nmp-lightbox-action="zoom-out" aria-label="Zoom out" title="Zoom out">&minus;</button>
        <button type="button" data-nmp-lightbox-action="reset" aria-label="Reset zoom" title="Reset zoom">100%</button>
        <button type="button" data-nmp-lightbox-action="zoom-in" aria-label="Zoom in" title="Zoom in">+</button>
        <button type="button" data-nmp-lightbox-close aria-label="Close enlarged image" title="Close">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <button class="nmp-lightbox-nav nmp-lightbox-prev" type="button" data-nmp-lightbox-action="prev" aria-label="Previous image">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <img class="nmp-lightbox-image" src="" alt="">
      <button class="nmp-lightbox-nav nmp-lightbox-next" type="button" data-nmp-lightbox-action="next" aria-label="Next image">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
      </button>
      <div class="nmp-lightbox-meta">
        <span class="nmp-lightbox-caption"></span>
        <span class="nmp-lightbox-counter"></span>
      </div>
    `;

    lightbox.addEventListener("click", (event) => {
      if (event.target.closest("[data-nmp-lightbox-close]")) closeLightbox();
      const action = event.target.closest("[data-nmp-lightbox-action]")?.dataset.nmpLightboxAction;
      if (action === "prev") {
        moveGallery(-1);
        syncLightboxImage();
      } else if (action === "next") {
        moveGallery(1);
        syncLightboxImage();
      } else if (action === "zoom-out") {
        setLightboxScale(state.lightboxScale - 0.25);
      } else if (action === "zoom-in") {
        setLightboxScale(state.lightboxScale + 0.25);
      } else if (action === "reset") {
        setLightboxScale(1);
      }
    });

    lightbox.addEventListener("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.15 : 0.15;
      setLightboxScale(state.lightboxScale + delta);
    }, { passive: false });

    document.body.append(lightbox);
    state.lightbox = lightbox;
    state.lightboxImage = lightbox.querySelector(".nmp-lightbox-image");
    state.lightboxCaption = lightbox.querySelector(".nmp-lightbox-caption");
    state.lightboxCounter = lightbox.querySelector(".nmp-lightbox-counter");
  }

  function openLightbox(src, alt) {
    ensureLightbox();
    setLightboxScale(1);
    state.lightboxImage.src = src;
    state.lightboxImage.alt = alt || "Mod media";
    state.lightbox.hidden = false;
    syncLightboxMeta();
  }

  function syncLightboxImage() {
    const item = state.currentMedia[state.currentIndex];
    if (!item || item.type !== "image") return;
    setLightboxScale(1);
    if (state.lightboxImage) {
      state.lightboxImage.src = item.src;
      state.lightboxImage.alt = item.alt || "Mod media";
    }
    syncLightboxMeta();
  }

  function setLightboxScale(scale) {
    state.lightboxScale = Math.max(0.5, Math.min(4, scale));
    if (state.lightboxImage) state.lightboxImage.style.transform = `scale(${state.lightboxScale})`;
    const reset = state.lightbox?.querySelector("[data-nmp-lightbox-action='reset']");
    if (reset) reset.textContent = `${Math.round(state.lightboxScale * 100)}%`;
  }

  function syncLightboxMeta() {
    const item = state.currentMedia[state.currentIndex];
    if (state.lightboxCaption) state.lightboxCaption.textContent = item?.alt || "Mod media";
    if (state.lightboxCounter) {
      state.lightboxCounter.textContent = `${state.currentIndex + 1} / ${state.currentMedia.length}`;
    }
  }

  function closeLightbox() {
    if (!state.lightbox) return;
    state.lightbox.hidden = true;
    state.lightboxImage.src = "";
    setLightboxScale(1);
  }

  function ensureModal() {
    if (state.modal) return;

    const modal = document.createElement("div");
    modal.className = "nmp-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="nmp-backdrop" data-nmp-close></div>
      <section class="nmp-dialog" role="dialog" aria-modal="true" aria-label="Nexus Mods media preview">
        <header class="nmp-header">
          <div class="nmp-header-main">
            <div class="nmp-mod-navigation" aria-label="Mod navigation">
              <button type="button" data-nmp-mod-nav="previous" aria-label="Previous mod" title="Previous mod">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button type="button" data-nmp-mod-nav="next" aria-label="Next mod" title="Next mod">
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
              </button>
            </div>
            <div class="nmp-heading">
              <div class="nmp-title-stack">
                <h2><a class="nmp-title-link" target="_blank" rel="noreferrer"></a></h2>
                <div class="nmp-meta-cards" aria-label="Mod details">
                  <a class="nmp-meta-card nmp-author-card" target="_blank" rel="noreferrer" hidden>
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <rect x="4" y="4" width="16" height="16" rx="3"></rect>
                      <path d="M8 18a4 4 0 0 1 8 0"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span></span>
                  </a>
                  <span class="nmp-meta-card nmp-total-downloads-card" hidden>
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <rect x="4" y="4" width="16" height="16" rx="3"></rect>
                      <path d="M8 16v-3M12 16V8M16 16v-5"></path>
                    </svg>
                    <span></span>
                  </span>
                </div>
              </div>
              <span class="nmp-download-status" hidden></span>
            </div>
          </div>
          <button class="nmp-close" type="button" aria-label="Close media preview" title="Close">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m6 6 12 12M18 6 6 18"/>
            </svg>
          </button>
        </header>
        <div class="nmp-content">
          <div class="nmp-info-stack">
            <section class="nmp-info-card nmp-description-card" aria-expanded="false" hidden>
              <div class="nmp-info-card-header">
                <h3>Description</h3>
                <button class="nmp-info-toggle" type="button" data-nmp-info-toggle aria-expanded="false" aria-label="Expand Description" title="Expand Description">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>
                </button>
              </div>
              <div class="nmp-info-card-body"><p></p></div>
            </section>
            <section class="nmp-info-card nmp-requirements-card" aria-expanded="false" hidden>
              <div class="nmp-info-card-header">
                <h3>Requirements</h3>
                <button class="nmp-info-toggle" type="button" data-nmp-info-toggle aria-expanded="false" aria-label="Expand Requirements" title="Expand Requirements">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg>
                </button>
              </div>
              <div class="nmp-info-card-body"><ul></ul></div>
            </section>
          </div>
          <div class="nmp-body"></div>
        </div>
      </section>
    `;

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-nmp-close], .nmp-close")) closePreview();
      if (event.target.closest("[data-nmp-mod-nav='previous']")) navigateMod(-1);
      if (event.target.closest("[data-nmp-mod-nav='next']")) navigateMod(1);
      const control = event.target.closest("[data-nmp-info-toggle]");
      if (control) {
        const infoCard = control.closest(".nmp-info-card");
        infoCardApi.toggle(infoCard, control);
        const expanded = infoCard.classList.contains("is-expanded");
        const label = `${expanded ? "Collapse" : "Expand"} ${infoCard.classList.contains("nmp-description-card") ? "Description" : "Requirements"}`;
        control.setAttribute("aria-label", label);
        control.setAttribute("title", label);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (!state.modal || state.modal.hidden) return;
      if (!userSettings.keyboardShortcuts) return;

      if (state.lightbox && !state.lightbox.hidden) {
        if (event.key === "Escape") closeLightbox();
        else if (event.key === "ArrowLeft") {
          moveGallery(-1);
          syncLightboxImage();
        } else if (event.key === "ArrowRight") {
          moveGallery(1);
          syncLightboxImage();
        } else if (event.key === "+" || event.key === "=") {
          setLightboxScale(state.lightboxScale + 0.25);
        } else if (event.key === "-") {
          setLightboxScale(state.lightboxScale - 0.25);
        } else if (event.key === "0") {
          setLightboxScale(1);
        } else {
          return;
        }
        event.preventDefault();
        return;
      }

      if (event.key === "Escape") {
        closePreview();
      }
      if (event.altKey && event.key === "ArrowLeft") navigateMod(-1);
      else if (event.altKey && event.key === "ArrowRight") navigateMod(1);
      else if (event.key === "ArrowLeft") moveGallery(-1);
      else if (event.key === "ArrowRight") moveGallery(1);
      if (event.key === "Enter" && document.activeElement?.classList.contains("nmp-stage")) {
        const item = state.currentMedia[state.currentIndex];
        if (item?.type === "image") openLightbox(item.src, item.alt);
      }
    });

    document.body.append(modal);
    state.modal = modal;
    state.title = modal.querySelector(".nmp-title-link");
    state.downloadStatus = modal.querySelector(".nmp-download-status");
    state.authorButton = modal.querySelector(".nmp-author-card");
    state.authorButtonLabel = state.authorButton.querySelector("span");
    state.totalDownloadsCard = modal.querySelector(".nmp-total-downloads-card");
    state.totalDownloadsValue = state.totalDownloadsCard.querySelector("span");
    state.descriptionCard = modal.querySelector(".nmp-description-card");
    state.descriptionText = state.descriptionCard.querySelector("p");
    state.requirementsCard = modal.querySelector(".nmp-requirements-card");
    state.requirementsList = state.requirementsCard.querySelector("ul");
    state.previousModButton = modal.querySelector("[data-nmp-mod-nav='previous']");
    state.nextModButton = modal.querySelector("[data-nmp-mod-nav='next']");
    state.body = modal.querySelector(".nmp-body");
    applyModalSettings();
  }

  function closePreview() {
    if (!state.modal) return;
    mediaLifecycleApi.stopEmbeddedVideos(state.body);
    if (state.body) state.body.innerHTML = "";
    state.modal.hidden = true;
    document.documentElement.classList.remove("nmp-lock-scroll");
    state.activeCard = null;
    state.currentMedia = [];
    state.currentMod = null;
    state.profileMediaMode = false;
    state.currentIndex = 0;
    renderDownloadStatus(null);
    renderModMetaCards(null);
    renderDescription(null);
    renderRequirements(null);
    closeLightbox();
  }

  function renderRequirements(requirements) {
    if (!state.requirementsCard || !state.requirementsList) return;
    if (!userSettings.showRequirements) {
      state.requirementsCard.hidden = true;
      state.requirementsList.innerHTML = "";
      return;
    }
    const available = Boolean(requirements?.length);
    state.requirementsCard.hidden = !available;
    infoCardApi.setExpanded(state.requirementsCard, false, state.requirementsCard.querySelector("[data-nmp-info-toggle]"));
    if (!available) {
      state.requirementsList.innerHTML = "";
      return;
    }
    state.requirementsList.innerHTML = requirements.map((req) => `
      <li><a href="${escapeHtml(req.url)}" target="_blank" rel="noreferrer">${escapeHtml(req.name)}</a></li>
    `).join("");
  }

  function toggleRequirements() {
    return;
  }

  function applyModalSettings() {
    if (!state.modal) return;
    for (const width of ["compact", "normal", "wide"]) {
      state.modal.classList.toggle(`nmp-width-${width}`, userSettings.modalWidth === width);
    }
    if (!userSettings.showDescription && state.descriptionCard) {
      state.descriptionCard.hidden = true;
    }
    if (!userSettings.showRequirements && state.requirementsCard) {
      state.requirementsCard.hidden = true;
    }
    if (state.authorButton && !userSettings.showAuthor) state.authorButton.hidden = true;
    state.body?.querySelector(".nmp-image-actions")?.toggleAttribute("hidden", !userSettings.showActionButtons);
  }

  function renderDownloadStatus(info) {
    if (!state.downloadStatus) return;
    state.downloadInfo = info;
    const verified = Boolean(info?.downloaded && info?.date instanceof Date && !Number.isNaN(info.date.valueOf()));
    state.downloadStatus.hidden = !verified;
    state.downloadStatus.classList.toggle("is-downloaded", verified);
    if (!verified) {
      state.downloadStatus.textContent = "";
      return;
    }

    state.downloadStatus.textContent = `Last Downloaded On ${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(info.date)}`;
  }

  function renderModMetaCards(meta) {
    if (state.authorButton && state.authorButtonLabel) {
      const author = meta?.author;
      state.authorButton.hidden = !userSettings.showAuthor || !author?.url || !author?.name;
      if (author?.url && author?.name) {
        state.authorButton.href = author.url;
        state.authorButtonLabel.textContent = `Author: ${author.name}`;
        state.authorButton.title = `Open ${author.name}'s profile`;
      } else {
        state.authorButton.removeAttribute("href");
        state.authorButtonLabel.textContent = "";
        state.authorButton.removeAttribute("title");
      }
    }

    if (state.totalDownloadsCard && state.totalDownloadsValue) {
      const totalDownloads = meta?.totalDownloads;
      state.totalDownloadsCard.hidden = !totalDownloads;
      state.totalDownloadsValue.textContent = totalDownloads ? `${totalDownloads} DLs` : "";
      state.totalDownloadsCard.title = totalDownloads ? `Total downloads: ${totalDownloads}` : "";
    }
  }

  function renderDescription(summary) {
    if (!state.descriptionCard || !state.descriptionText) return;
    if (!userSettings.showDescription) {
      state.descriptionCard.hidden = true;
      state.descriptionText.textContent = "";
      return;
    }
    const available = Boolean(summary);
    state.descriptionCard.hidden = !available;
    infoCardApi.setExpanded(state.descriptionCard, false, state.descriptionCard.querySelector("[data-nmp-info-toggle]"));
    state.descriptionText.textContent = available ? summary : "";
  }

  function toggleDescription() {
    return;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  scheduleInjectButtons();

  window.addEventListener("scroll", hideLinkPopover, true);
  window.addEventListener("resize", hideLinkPopover);

  const observer = new MutationObserver(() => scheduleInjectButtons());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "class",
      "style",
      "hidden",
      "aria-hidden",
      "data-state",
      "data-visible",
      "src",
      "srcset",
      "data-src",
      "data-original",
      "data-full"
    ]
  });

  function scheduleInjectButtons() {
    if (injectScheduled) return;
    injectScheduled = true;
    requestAnimationFrame(() => {
      injectScheduled = false;
      try {
        injectButtons();
      } catch (error) {
        console.warn("[Nexus Media Preview] Injection skipped:", error);
      }
    });
  }
})();
