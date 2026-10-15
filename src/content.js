// Page wiring. Nothing scans the page: targets are resolved lazily from the
// element under the pointer (or focus), using the stable hooks documented in
// docs/recon-nexus.md. Buttons are injected on first hover only.
(() => {
  if (globalThis.__nexusMediaPreviewLoaded) return;
  globalThis.__nexusMediaPreviewLoaded = true;

  const sources = globalThis.NexusMediaPreviewSources;
  const settingsApi = globalThis.NexusMediaPreviewSettings;
  const ext = globalThis.chrome?.runtime?.id ? globalThis.chrome : null;

  const MOD_TILE = "[data-e2eid='mod-tile'], [data-e2eid='mod-tile-teaser']";
  const TILE = `${MOD_TILE}, [data-e2eid='media-tile']`;
  // Notification rows (bell panel in the header, /notifications pages).
  const NOTIFICATION_IMAGE = "img[data-testid='notification-group-image']";
  const IGNORED_LINK_AREA = "nav, footer, [role='navigation'], [role='tab'], [data-e2eid$='-header'], #mod-page-tab-list, .pagination";
  const CAMERA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.5" r="3.5"/></svg>';

  let settings = settingsApi.sanitize();
  settingsApi.load().then((value) => { settings = value; });
  ext?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== "sync") return;
    const next = { ...settings };
    for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
    settings = settingsApi.sanitize(next);
  });

  // ---------- Data ----------
  const cache = new Map();
  function cached(key, load) {
    if (!cache.has(key)) {
      const promise = load();
      cache.set(key, promise);
      promise.catch(() => cache.delete(key));
    }
    return cache.get(key);
  }

  function message(payload) {
    if (!ext) return Promise.reject(new Error("Extension context unavailable. Reload the page."));
    return new Promise((resolve, reject) => {
      ext.runtime.sendMessage(payload, (response) => {
        const error = ext.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(response);
      });
    });
  }

  async function fetchDocument(url) {
    let html;
    if (new URL(url).origin === location.origin) {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(`The page answered ${response.status}.`);
      html = await response.text();
    } else {
      // Cross-site (e.g. a Nexus link on La Confrérie): the background worker
      // holds the host permission, the page origin does not.
      const response = await message({ type: "nmp-fetch-page", url });
      if (!response?.ok) throw new Error(response?.error || "The page could not be loaded.");
      html = response.html;
    }
    return new DOMParser().parseFromString(html, "text/html");
  }

  const loadMod = (mod) => cached(mod.url, async () => sources.parseNexusModPage(await fetchDocument(mod.url), mod));
  const loadVideos = (mod) => cached(`${mod.url}#videos`, async () => sources.parseNexusVideosTab(await fetchDocument(`${mod.url}?tab=videos`)));
  const loadMedia = (link) => cached(link.url, async () => sources.parseNexusMediaPage(await fetchDocument(link.url), link.url));
  const loadConfrerie = (link) => cached(link.url, async () => sources.parseConfreriePage(await fetchDocument(link.url), link.url));

  // ---------- Targets ----------
  const textOf = (node) => sources.cleanText(node?.textContent);
  const pageLink = () => sources.parseAnyUrl(location.href);

  function linkOf(anchor) {
    const href = anchor?.getAttribute("href");
    return href && !href.startsWith("#") ? sources.parseAnyUrl(href, location.href) : null;
  }

  function resolveTarget(node) {
    if (!(node instanceof Element) || node.closest("nmp-root, .nmp-button")) return null;
    if (node.getRootNode().host?.localName === "nmp-root") return null;

    const tile = node.closest(TILE);
    if (tile) {
      const anchor = tile.querySelector("a[href] img")?.closest("a[href]");
      const link = linkOf(anchor);
      // Pin the button to the image frame: logged-in cards show Nexus's own
      // "Update available" / downloaded badge in the top-left corner.
      return link ? { kind: "tile", tile, anchor, holder: anchor.querySelector("img").parentElement, link } : null;
    }

    const anchor = node.closest("a[href]");
    if (!anchor) return null;

    const currentPage = pageLink();
    // La Confrérie mod page: full-size screenshots (a slider inside <header>)
    // open the page gallery.
    if (currentPage?.site === "confrerie" && /\/images\/big\//.test(anchor.getAttribute("href"))) {
      return { kind: "image", anchor, holder: anchor, link: { ...currentPage, focusSrc: anchor.href } };
    }
    // The bell panel lives inside the site header, so check it before ignoring header links.
    const thumb = anchor.querySelector(NOTIFICATION_IMAGE);
    if (thumb) {
      const link = linkOf(anchor);
      return link && link.url !== currentPage?.url ? { kind: "notification", anchor, holder: thumb.parentElement, link, small: true } : null;
    }
    if (anchor.closest(IGNORED_LINK_AREA)) return null;

    const link = linkOf(anchor);
    if (!link || link.url === currentPage?.url) return null;
    const img = anchor.querySelector("img");
    if (img && img.getBoundingClientRect().width >= 64) return { kind: "image", anchor, holder: anchor, link };
    return textOf(anchor) ? { kind: "text", anchor, link } : null;
  }

  // styles.css is a content-script stylesheet: it does not reach into the
  // page's own shadow roots, so link it there once.
  const styledRoots = new WeakSet();
  function styleShadowRoot(node) {
    const root = node.getRootNode();
    if (!(root instanceof ShadowRoot) || styledRoots.has(root) || !ext) return;
    styledRoots.add(root);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = ext.runtime.getURL("src/styles.css");
    root.append(link);
  }

  function ensureButton(target) {
    const { holder } = target;
    if (!holder || holder.querySelector(":scope > .nmp-button")) return;
    styleShadowRoot(holder);
    holder.classList.add("nmp-host");
    const button = document.createElement("button");
    button.type = "button";
    button.className = target.small ? "nmp-button is-small" : "nmp-button";
    button.title = "Preview media (Space)";
    button.setAttribute("aria-label", "Preview media");
    button.innerHTML = CAMERA;
    button.nmpTarget = target;
    holder.append(button);
  }

  // ---------- Viewer ----------
  const viewer = globalThis.NexusMediaPreviewViewer.create({
    cssUrl: ext ? ext.runtime.getURL("src/viewer.css") : null,
    getSettings: () => settings,
    onNavigate: navigate,
    onClose: () => { current = null; },
    onPopoverClick: (anchor) => {
      const target = resolveTarget(anchor);
      if (target) openTarget(target);
    },
    actions: {
      copy(item) {
        if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
          return Promise.reject(new Error("Image copy is not supported by this browser."));
        }
        // Passing a promise keeps the user activation while the image loads.
        return navigator.clipboard.write([new ClipboardItem({ "image/png": imageAsPng(item.src) })]);
      },
      async download(item, index) {
        const name = decodeURIComponent(new URL(item.src).pathname.split("/").pop() || "") || `nexus-media-${index + 1}.jpg`;
        const response = await message({ type: "nmp-download-image", url: item.src, filename: name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-") });
        if (!response?.ok) throw new Error(response?.error || "The browser refused the download.");
      }
    }
  });

  async function imageAsPng(src) {
    const response = await message({ type: "nmp-fetch-image", url: src });
    if (!response?.ok) throw new Error(response?.error || "The image could not be fetched.");
    const bytes = Uint8Array.from(atob(response.data), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: response.type });
    if (blob.type === "image/png") return blob;
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close();
    return new Promise((resolve, reject) => canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("PNG conversion failed."))), "image/png"));
  }

  let current = null;
  let openToken = 0;

  function chipsFromTile(tile) {
    if (!tile) return [];
    const user = tile.querySelector("[data-e2eid='user-link']");
    const downloads = textOf(tile.querySelector("[data-e2eid='mod-tile-downloads']"));
    const endorsements = textOf(tile.querySelector("[data-e2eid='mod-tile-endorsements']"));
    return [
      settings.showAuthor && user ? { icon: "user", label: textOf(user), url: user.href, title: "Author profile" } : null,
      downloads ? { icon: "downloads", label: `${downloads} downloads` } : null,
      endorsements ? { icon: "heart", label: endorsements, title: "Endorsements" } : null
    ].filter(Boolean);
  }

  function modTargets(kind = "tile", root = document) {
    const seen = new Set();
    const nodes = kind === "notification"
      ? [...root.querySelectorAll(NOTIFICATION_IMAGE)].map((img) => img.closest("a[href]")).filter(Boolean)
      : [...root.querySelectorAll(MOD_TILE)];
    return nodes
      .map(resolveTarget)
      .filter((target) => target?.link.site === "nexus" && !seen.has(target.link.url) && seen.add(target.link.url));
  }

  function openTarget(target) {
    const { link } = target;
    if (settings.openMode !== "modal") {
      if (settings.openMode === "new-tab") window.open(link.url, "_blank", "noopener");
      else location.assign(link.url);
      return;
    }
    stopPeek();
    current = target;
    const token = ++openToken;
    if (link.site === "nexus") openMod(target, token);
    else if (link.site === "nexus-media") openMedia(target, token);
    else openConfrerie(target, token);
  }

  async function openMod(target, token) {
    const { link, tile } = target;
    const title = target.kind === "notification"
      ? `Mod ${link.modId}`
      : textOf(tile?.querySelector("[data-e2eid='mod-tile-title']")) || target.anchor.querySelector("img")?.alt || textOf(target.anchor) || `Mod ${link.modId}`;
    const chips = chipsFromTile(tile);
    const canNavigate = (target.kind === "tile" || target.kind === "notification") && modTargets(target.kind, target.anchor.getRootNode()).length > 1;
    viewer.open({ site: "nexus", title, url: link.url, chips, canNavigate, context: target.anchor });
    try {
      const data = await loadMod(link);
      if (token !== openToken) return;
      if (data.blocked === "adult") {
        viewer.update({ title, url: link.url, chips, emptyMessage: "Adult content", emptyDetail: "Log in to Nexus Mods and enable adult content in your settings to preview this mod." });
        return;
      }
      if (!chips.some((chip) => chip.icon === "user") && settings.showAuthor && data.author) {
        chips.unshift({ icon: "user", label: data.author.name, url: data.author.url, title: "Author" });
      }
      if (data.lastDownload) chips.push({ icon: "check", label: `Downloaded ${data.lastDownload}`, accent: true });
      viewer.update({
        ...data,
        chips,
        links: [
          { label: "Files", url: `${link.url}?tab=files` },
          { label: "All images", url: `${link.url}?tab=images` },
          ...(data.videoCount ? [{ label: `Videos (${data.videoCount})`, url: `${link.url}?tab=videos` }] : []),
          { label: "Posts", url: `${link.url}?tab=posts` }
        ]
      });
      if (settings.showYoutube && data.videoCount) {
        const videos = await loadVideos(link);
        if (token === openToken) viewer.appendItems(videos);
      }
    } catch (error) {
      if (token === openToken) viewer.fail(error.message, link.url);
    }
  }

  function mediaItemFromTile(tile) {
    const anchor = tile.querySelector("a[href] img")?.closest("a[href]");
    const link = linkOf(anchor);
    const thumb = anchor?.querySelector("img")?.getAttribute("src");
    if (!link || !thumb) return null;
    const caption = textOf(tile.querySelector("[data-e2eid='media-tile-title']")) || anchor.querySelector("img").alt || "Nexus media";
    if (link.kind === "video") {
      const id = sources.youtubeId(thumb);
      return id ? { type: "video", id, title: caption, caption, thumb, pageUrl: link.url } : null;
    }
    return { type: "image", src: sources.fullImageUrl(thumb), thumb, caption, pageUrl: link.url };
  }

  async function openMedia(target, token) {
    const { link } = target;
    viewer.open({ site: "nexus-media", title: textOf(target.tile?.querySelector("[data-e2eid='media-tile-title']")) || "Nexus media", url: link.url, context: target.anchor });
    if (target.kind === "tile") {
      // Media grids need no request at all: thumbnails map to full images.
      const items = [...document.querySelectorAll("[data-e2eid='media-tile']")].map(mediaItemFromTile).filter(Boolean);
      const startIndex = Math.max(0, items.findIndex((item) => item.pageUrl === link.url));
      viewer.update({ items, startIndex, itemTitles: true, url: link.url });
      return;
    }
    try {
      const data = await loadMedia(link);
      if (token === openToken) viewer.update({ ...data, itemTitles: true, links: [{ label: "Media page", url: link.url }] });
    } catch (error) {
      if (token === openToken) viewer.fail(error.message, link.url);
    }
  }

  async function openConfrerie(target, token) {
    const { link } = target;
    viewer.open({ site: "confrerie", title: textOf(target.anchor) || "Confrérie mod", url: link.url, context: target.anchor });
    try {
      const data = link.url === pageLink()?.url
        ? sources.parseConfreriePage(document, link.url)
        : await loadConfrerie(link);
      if (token !== openToken) return;
      const startIndex = link.focusSrc ? Math.max(0, data.items.findIndex((item) => item.src === link.focusSrc)) : 0;
      const chips = [
        data.version ? { icon: "check", label: `v${data.version}`, title: "Translated version" } : null,
        ...data.credits.map((credit) => ({ icon: "user", label: credit })),
        settings.showAuthor && data.originalAuthor ? { icon: "user", label: `Original by ${data.originalAuthor}`, url: data.nexusUrl } : null
      ].filter(Boolean);
      viewer.update({
        ...data,
        chips,
        startIndex,
        links: [
          { label: "Mod page", url: link.url },
          ...(data.nexusUrl ? [{ label: "Original on Nexus", url: data.nexusUrl }] : [])
        ]
      });
    } catch (error) {
      if (token === openToken) viewer.fail(error.message, link.url);
    }
  }

  function navigate(direction) {
    if (!current) return;
    const list = modTargets(current.kind === "notification" ? "notification" : "tile", current.anchor.getRootNode());
    const index = list.findIndex((target) => target.link.url === current.link.url);
    if (index < 0 || list.length < 2) return;
    const next = list[(index + direction + list.length) % list.length];
    (next.tile || next.anchor).scrollIntoView({ block: "nearest", behavior: "smooth" });
    openTarget(next);
  }

  // ---------- Hover peek: a mod tile flips through its screenshots ----------
  const peek = { target: null, timer: 0, interval: 0, img: null, original: null, dots: null };

  function armPeek(target) {
    if (!settings.hoverPeek || target.link.site !== "nexus" || peek.target?.tile === target.tile) return;
    // Self-playing imagery is exactly what "reduce motion" asks to avoid.
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    stopPeek();
    peek.target = target;
    peek.timer = setTimeout(() => startPeek(target), 650);
  }

  async function startPeek(target) {
    const img = target.anchor.querySelector("img");
    let data;
    try {
      data = await loadMod(target.link);
    } catch {
      return;
    }
    if (peek.target !== target || viewer.isOpen || !img) return;
    const thumbs = (data.items || []).filter((item) => item.type === "image").map((item) => item.thumb).slice(0, 8);
    if (thumbs.length < 2) return;

    peek.img = img;
    peek.original = { src: img.getAttribute("src"), srcset: img.getAttribute("srcset") };
    img.removeAttribute("srcset");
    peek.dots = document.createElement("span");
    peek.dots.className = "nmp-peek";
    peek.dots.innerHTML = thumbs.map(() => "<i></i>").join("");
    // Pin the dots to the image frame, not the card (teasers put text below it).
    img.parentElement.classList.add("nmp-host");
    img.parentElement.append(peek.dots);
    thumbs.forEach((src) => { new Image().src = src; });

    let i = 0;
    const step = () => {
      i = (i + 1) % thumbs.length;
      img.src = thumbs[i];
      peek.dots.querySelectorAll("i").forEach((dot, n) => dot.classList.toggle("is-on", n === i));
    };
    step();
    peek.interval = setInterval(step, 1100);
  }

  function stopPeek() {
    clearTimeout(peek.timer);
    clearInterval(peek.interval);
    if (peek.img && peek.original) {
      peek.img.setAttribute("src", peek.original.src);
      if (peek.original.srcset) peek.img.setAttribute("srcset", peek.original.srcset);
    }
    peek.dots?.remove();
    Object.assign(peek, { target: null, timer: 0, interval: 0, img: null, original: null, dots: null });
  }

  // ---------- Events (delegated, no page scanning) ----------
  // On legacy mod pages Nexus renders its header (and the quick-search
  // results) inside an open shadow root (#next-shadow-root). Document
  // listeners only see that host, so every handler reads the real origin
  // from composedPath() and the deepest focused / hovered element.
  let hovered = null;
  const pointer = { x: -1, y: -1 };

  const origin = (event) => event.composedPath()[0];

  function deepActiveElement() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  }

  function deepElementFromPoint(x, y) {
    let element = document.elementFromPoint(x, y);
    while (element?.shadowRoot) {
      const inner = element.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === element) break;
      element = inner;
    }
    return element;
  }

  function activate(target, point) {
    if (target.kind === "text") {
      if (viewer.popoverAnchor !== target.anchor) viewer.showPopover(target.anchor, point);
    } else {
      ensureButton(target);
      if (target.kind === "tile") armPeek(target);
    }
  }

  // Inside the quick search on mod pages, Nexus swallows pointerover before it
  // reaches the document, so pointermove is watched too. Both run at window
  // capture and only do work when the element under the pointer changes.
  let lastOrigin = null;
  function onPointer(event) {
    if (event.pointerType === "touch") return;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const node = origin(event);
    if (node === lastOrigin) return;
    lastOrigin = node;
    hovered = resolveTarget(node);
    if (hovered) activate(hovered, { x: event.clientX, y: event.clientY });
  }
  window.addEventListener("pointerover", onPointer, true);
  window.addEventListener("pointermove", onPointer, { capture: true, passive: true });

  // relatedTarget is retargeted at shadow boundaries, so ask :hover instead
  // (it works across them) once the pointer has settled.
  let outCheck = 0;
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) hovered = null;
    cancelAnimationFrame(outCheck);
    outCheck = requestAnimationFrame(() => {
      const anchor = viewer.popoverAnchor;
      if (anchor && !anchor.matches(":hover")) viewer.scheduleHidePopover();
      if (peek.target && !peek.target.tile.matches(":hover")) stopPeek();
    });
  }, true);

  document.addEventListener("focusin", (event) => {
    const target = resolveTarget(origin(event));
    if (target) activate(target);
  });

  document.addEventListener("click", (event) => {
    const node = origin(event);
    const button = node instanceof Element && node.closest(".nmp-button");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    openTarget(button.nmpTarget);
  }, true);

  // Quick Look: Space on a hovered/focused mod or media opens the preview.
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " || event.repeat || event.defaultPrevented || viewer.isOpen || !settings.keyboardShortcuts) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const active = deepActiveElement();
    if (active?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active?.tagName || "")) return;
    // The pointer may rest on a card the preview was covering: look it up again.
    const target = resolveTarget(active)
      || (hovered?.anchor.isConnected ? hovered : null)
      || (pointer.x >= 0 ? resolveTarget(deepElementFromPoint(pointer.x, pointer.y)) : null);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    openTarget(target);
  }, true);

  window.addEventListener("scroll", () => viewer.hidePopover(), { passive: true, capture: true });
})();
