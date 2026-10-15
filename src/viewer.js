// Preview UI: modal gallery, lightbox and link popover, all inside one shadow
// root so neither Nexus nor La Confrérie styles can affect it.
(() => {
  const ICONS = {
    prev: '<path d="m15 18-6-6 6-6"/>',
    next: '<path d="m9 6 6 6-6 6"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    download: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
    external: '<path d="M14 4h6v6m0-6L10 14m10 0v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/>',
    camera: '<path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="12.5" r="3.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    downloads: '<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    play: '<path d="M8 5v14l11-7Z"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  function create({ cssUrl, getSettings, onNavigate, onClose, onPopoverClick, actions }) {
    const host = document.createElement("nmp-root");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      ${cssUrl ? `<link rel="stylesheet" href="${escapeHtml(cssUrl)}">` : "<style data-nmp-inline></style>"}
      <div class="modal" hidden>
        <div class="backdrop" data-act="close"></div>
        <section class="dialog" role="dialog" aria-modal="true" aria-label="Media preview" tabindex="-1">
          <header class="header">
            <div class="mod-nav">
              <button class="icon-button" type="button" data-act="prev-mod" aria-label="Previous mod" title="Previous mod (Alt+←)">${icon("prev")}</button>
              <button class="icon-button" type="button" data-act="next-mod" aria-label="Next mod" title="Next mod (Alt+→)">${icon("next")}</button>
            </div>
            <div class="heading">
              <a class="title" target="_blank" rel="noreferrer"></a>
              <div class="chips"></div>
            </div>
            <button class="icon-button" type="button" data-act="close" aria-label="Close" title="Close (Esc)">${icon("close")}</button>
          </header>
          <div class="main">
            <div class="stage-wrap">
              <button class="stage" type="button" data-act="zoom" aria-label="Open full size"></button>
              <button class="arrow prev" type="button" data-act="prev" aria-label="Previous media">${icon("prev")}</button>
              <button class="arrow next" type="button" data-act="next" aria-label="Next media">${icon("next")}</button>
              <div class="tools">
                <button class="icon-button" type="button" data-act="copy" aria-label="Copy image" title="Copy image">${icon("copy")}</button>
                <button class="icon-button" type="button" data-act="download" aria-label="Download image" title="Download image">${icon("download")}</button>
                <button class="icon-button" type="button" data-act="open-tab" aria-label="Open image in a new tab" title="Open image in a new tab">${icon("external")}</button>
              </div>
              <span class="counter"></span>
              <span class="status" role="status" aria-live="polite"></span>
            </div>
            <div class="strip" aria-label="Media"></div>
          </div>
          <aside class="side"></aside>
        </section>
      </div>
      <div class="lightbox" hidden>
        <img alt="">
        <button class="arrow prev" type="button" data-act="prev" aria-label="Previous image">${icon("prev")}</button>
        <button class="arrow next" type="button" data-act="next" aria-label="Next image">${icon("next")}</button>
        <div class="lb-tools">
          <button class="icon-button" type="button" data-lb="out" aria-label="Zoom out">−</button>
          <button class="icon-button" type="button" data-lb="reset" aria-label="Reset zoom">100%</button>
          <button class="icon-button" type="button" data-lb="in" aria-label="Zoom in">+</button>
          <button class="icon-button" type="button" data-lb="close" aria-label="Close full size">${icon("close")}</button>
        </div>
        <span class="lb-caption"></span>
      </div>
      <button class="popover" type="button" hidden>${icon("camera")}<span>Preview</span><kbd>Space</kbd></button>
    `;

    const $ = (selector) => root.querySelector(selector);
    const modal = $(".modal");
    const dialog = $(".dialog");
    const title = $(".title");
    const chips = $(".chips");
    const stage = $(".stage");
    const strip = $(".strip");
    const side = $(".side");
    const counter = $(".counter");
    const status = $(".status");
    const lightbox = $(".lightbox");
    const lbImage = lightbox.querySelector("img");
    const popover = $(".popover");

    let items = [];
    let index = 0;
    let canNavigate = false;
    let itemTitles = false;
    let zoom = { scale: 1, x: 0, y: 0 };
    let statusTimer = 0;
    let savedOverflow = "";
    let popoverTimer = 0;

    const drag = globalThis.NexusMediaPreviewModalDrag;
    drag?.attach(dialog, $(".header"));
    // Mount right away so the shadow stylesheet is loaded before the first
    // popover has to be measured.
    document.body.append(host);

    function mount(context) {
      // A Headless UI dialog (Nexus quick search) makes everything outside it
      // inert: when the preview starts from inside a dialog, mount there.
      const parent = context?.closest?.("[role='dialog']") || document.body;
      if (host.parentNode !== parent) parent.append(host);
    }

    // ---------- Rendering ----------
    function renderChips(list = []) {
      chips.innerHTML = list.filter(Boolean).map((chip) => {
        const body = `${icon(chip.icon || "check")}<span>${escapeHtml(chip.label)}</span>`;
        const cls = `chip${chip.accent ? " is-accent" : ""}`;
        return chip.url
          ? `<a class="${cls}" href="${escapeHtml(chip.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(chip.title || chip.label)}">${body}</a>`
          : `<span class="${cls}" title="${escapeHtml(chip.title || chip.label)}">${body}</span>`;
      }).join("");
    }

    function renderSide(data) {
      const settings = getSettings();
      const parts = [];
      if (data.loading) {
        parts.push('<section><h3>About</h3><div class="skeleton"></div><div class="skeleton"></div></section>');
      }
      if (settings.showDescription && data.summary) {
        parts.push(`<section class="summary"><h3>About</h3><p>${escapeHtml(data.summary)}</p><button class="more" type="button" data-act="more" hidden>Show more</button></section>`);
      }
      if (settings.showRequirements && data.requirements?.length) {
        parts.push(`<section class="requirements"><h3>Requirements</h3><ul>${data.requirements.map((req) => `<li>${
          req.url
            ? `<a href="${escapeHtml(req.url)}" target="_blank" rel="noreferrer">${escapeHtml(req.name)}${req.offsite ? "<small>off-site</small>" : ""}</a>`
            : `<span>${escapeHtml(req.name)}</span>`
        }</li>`).join("")}</ul></section>`);
      }
      if (data.links?.length) {
        parts.push(`<section><h3>Open</h3><div class="links">${data.links.map((link) => `<a href="${escapeHtml(link.url)}" target="${link.newTab === false ? "_self" : "_blank"}" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")}</div></section>`);
      }
      side.innerHTML = parts.join("");
      dialog.classList.toggle("no-side", !parts.length || getSettings().modalWidth === "compact");
      const summary = side.querySelector(".summary p");
      if (summary && summary.scrollHeight > summary.clientHeight + 2) side.querySelector(".more").hidden = false;
    }

    function visibleItems(list) {
      return getSettings().showYoutube ? list : list.filter((item) => item.type !== "video");
    }

    function renderStrip() {
      strip.hidden = items.length < 2;
      strip.innerHTML = items.map((item, i) => `
        <button class="thumb" type="button" data-index="${i}" aria-label="${item.type === "video" ? "Video" : "Image"} ${i + 1}">
          <img src="${escapeHtml(item.thumb || item.src)}" alt="" loading="lazy">
          ${item.type === "video" ? `<span class="play">${icon("play")}</span>` : ""}
        </button>`).join("");
    }

    function show(i) {
      if (!items.length) return;
      index = (i + items.length) % items.length;
      const item = items[index];
      stage.classList.toggle("is-video", item.type === "video");
      if (item.type === "video") {
        stage.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(item.id)}?autoplay=1" title="${escapeHtml(item.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      } else {
        stage.innerHTML = `<img class="is-loading" alt="${escapeHtml(item.caption || "")}">`;
        const img = stage.firstElementChild;
        img.onload = img.onerror = () => img.classList.remove("is-loading");
        img.src = item.src;
        // Warm the neighbours so arrow navigation feels instant.
        for (const near of [items[index + 1], items[index - 1]]) {
          if (near?.type === "image") new Image().src = near.src;
        }
      }
      counter.textContent = `${index + 1} / ${items.length}`;
      if (itemTitles) {
        title.textContent = item.caption || item.title || "Nexus media";
        title.href = item.pageUrl || title.href;
      }
      root.querySelectorAll(".arrow").forEach((arrow) => { arrow.hidden = items.length < 2; });
      $(".tools").hidden = item.type !== "image" || !getSettings().showActionButtons;
      strip.querySelectorAll(".thumb").forEach((thumb) => thumb.classList.toggle("is-active", Number(thumb.dataset.index) === index));
      // Scroll the strip only: scrollIntoView() would also scroll the page behind the modal.
      const active = strip.querySelector(".thumb.is-active");
      if (active) {
        const a = active.getBoundingClientRect();
        const b = strip.getBoundingClientRect();
        if (a.left < b.left || a.right > b.right) strip.scrollBy({ left: a.left - b.left - (b.width - a.width) / 2, behavior: "smooth" });
      }
      if (!lightbox.hidden) syncLightbox();
    }

    function renderEmpty(message, detail, url) {
      items = [];
      stage.classList.add("is-video");
      stage.innerHTML = `<div class="empty"><strong>${escapeHtml(message)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open the page</a>` : ""}</div>`;
      strip.innerHTML = "";
      strip.hidden = true;
      counter.textContent = "";
      $(".tools").hidden = true;
      root.querySelectorAll(".modal .arrow").forEach((arrow) => { arrow.hidden = true; });
    }

    function setStatus(text) {
      status.textContent = text;
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => { status.textContent = ""; }, 1800);
    }

    // ---------- Public API ----------
    function open(entry) {
      mount(entry.context);
      hidePopover();
      const settings = getSettings();
      host.dataset.site = entry.site || "nexus";
      modal.dataset.width = settings.modalWidth;
      if (modal.hidden) drag?.reset(dialog);
      canNavigate = Boolean(entry.canNavigate);
      $("[data-act='prev-mod']").parentElement.hidden = !canNavigate;
      title.textContent = entry.title || "Loading…";
      title.href = entry.url || "#";
      renderChips(entry.chips);
      items = [];
      stage.classList.add("is-video");
      stage.innerHTML = '<div class="spinner" role="status" aria-label="Loading"></div>';
      strip.innerHTML = "";
      counter.textContent = "";
      $(".tools").hidden = true;
      renderSide({ loading: entry.site !== "nexus-media" });
      if (modal.hidden) {
        savedOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = "hidden";
      }
      modal.hidden = false;
      dialog.focus({ preventScroll: true });
    }

    function update(data) {
      if (data.title) title.textContent = data.title;
      if (data.url) title.href = data.url;
      if (data.chips) renderChips(data.chips);
      renderSide(data);
      itemTitles = Boolean(data.itemTitles);
      items = visibleItems(data.items || []);
      if (!items.length) {
        renderEmpty(data.emptyMessage || "No media found", data.emptyDetail, data.url);
        return;
      }
      renderStrip();
      show(data.startIndex || 0);
    }

    function appendItems(extra) {
      const more = visibleItems(extra).filter((item) => !items.some((known) => known.type === item.type && (known.id || known.src) === (item.id || item.src)));
      if (!more.length) return;
      const wasEmpty = !items.length;
      items = [...items, ...more];
      renderStrip();
      show(wasEmpty ? 0 : index);
    }

    function fail(message, url) {
      renderSide({});
      renderEmpty("Could not load this preview", message, url);
    }

    function close() {
      if (modal.hidden) return;
      closeLightbox();
      stage.innerHTML = "";
      modal.hidden = true;
      document.documentElement.style.overflow = savedOverflow;
      onClose?.();
    }

    // ---------- Lightbox ----------
    function applyZoom() {
      lbImage.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
      lightbox.querySelector("[data-lb='reset']").textContent = `${Math.round(zoom.scale * 100)}%`;
    }
    function setZoom(scale) {
      zoom.scale = Math.min(6, Math.max(0.5, scale));
      if (zoom.scale <= 1) zoom.x = zoom.y = 0;
      applyZoom();
    }
    function syncLightbox() {
      const item = items[index];
      if (item?.type !== "image") return closeLightbox();
      zoom = { scale: 1, x: 0, y: 0 };
      applyZoom();
      lbImage.src = item.src;
      lightbox.querySelector(".lb-caption").textContent = `${index + 1} / ${items.length}${item.caption ? ` · ${item.caption}` : ""}`;
    }
    function openLightbox() {
      if (items[index]?.type !== "image") return;
      lightbox.hidden = false;
      syncLightbox();
    }
    function closeLightbox() {
      lightbox.hidden = true;
      lbImage.removeAttribute("src");
    }

    lightbox.addEventListener("wheel", (event) => {
      event.preventDefault();
      setZoom(zoom.scale * (event.deltaY > 0 ? 0.88 : 1.14));
    }, { passive: false });
    lbImage.addEventListener("pointerdown", (event) => {
      if (zoom.scale <= 1) return;
      const start = { x: event.clientX - zoom.x, y: event.clientY - zoom.y };
      lbImage.setPointerCapture(event.pointerId);
      lbImage.classList.add("is-panning");
      const moveHandler = (e) => { zoom.x = e.clientX - start.x; zoom.y = e.clientY - start.y; applyZoom(); };
      const up = () => {
        lbImage.classList.remove("is-panning");
        lbImage.removeEventListener("pointermove", moveHandler);
        lbImage.removeEventListener("pointerup", up);
      };
      lbImage.addEventListener("pointermove", moveHandler);
      lbImage.addEventListener("pointerup", up);
    });
    lbImage.addEventListener("dblclick", () => setZoom(zoom.scale > 1 ? 1 : 2.5));
    lightbox.addEventListener("click", (event) => {
      const action = event.target.closest("[data-lb]")?.dataset.lb;
      if (action === "in") setZoom(zoom.scale * 1.25);
      else if (action === "out") setZoom(zoom.scale / 1.25);
      else if (action === "reset") setZoom(1);
      else if (action === "close" || event.target === lightbox) closeLightbox();
    });

    // ---------- Events ----------
    root.addEventListener("click", (event) => {
      const thumb = event.target.closest(".thumb");
      if (thumb) return show(Number(thumb.dataset.index));
      const action = event.target.closest("[data-act]")?.dataset.act;
      const item = items[index];
      switch (action) {
        case "close": return close();
        case "prev": return show(index - 1);
        case "next": return show(index + 1);
        case "prev-mod": return onNavigate?.(-1);
        case "next-mod": return onNavigate?.(1);
        case "zoom": return openLightbox();
        case "more": side.querySelector(".summary").classList.add("is-open"); event.target.remove(); return;
        case "open-tab": if (item?.src) window.open(item.src, "_blank", "noopener"); return;
        case "copy":
        case "download":
          if (item?.type !== "image") return;
          setStatus(action === "copy" ? "Copying…" : "Downloading…");
          actions[action](item, index).then(
            () => setStatus(action === "copy" ? "Image copied" : "Download started"),
            (error) => { setStatus(action === "copy" ? "Copy failed" : "Download failed"); console.warn("[Nexus Media Preview]", error); }
          );
      }
    });

    // Capture phase so page-level shortcut handlers (Nexus "/" search etc.)
    // never see keys meant for the preview.
    document.addEventListener("keydown", (event) => {
      if (modal.hidden || !getSettings().keyboardShortcuts) return;
      const inLightbox = !lightbox.hidden;
      const key = event.key;
      let handled = true;
      if (key === "Escape") inLightbox ? closeLightbox() : close();
      else if (event.altKey && key === "ArrowLeft" && canNavigate) onNavigate?.(-1);
      else if (event.altKey && key === "ArrowRight" && canNavigate) onNavigate?.(1);
      else if (key === "ArrowLeft") show(index - 1);
      else if (key === "ArrowRight") show(index + 1);
      else if (inLightbox && (key === "+" || key === "=")) setZoom(zoom.scale * 1.25);
      else if (inLightbox && key === "-") setZoom(zoom.scale / 1.25);
      else if (inLightbox && key === "0") setZoom(1);
      else if ((key === "Enter" || key === " ") && /^(A|BUTTON)$/.test(event.composedPath()[0]?.tagName || "")) handled = false;
      else if (key === "Enter" && !inLightbox) openLightbox();
      else if (key === " ") inLightbox ? closeLightbox() : close();
      else handled = false;
      if (handled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    // ---------- Popover for text links ----------
    let popoverAnchor = null;
    function showPopover(anchor, point) {
      mount(anchor);
      clearTimeout(popoverTimer);
      popoverAnchor = anchor;
      popover.hidden = false;
      // Anchor to the line of the link under the pointer (links can wrap).
      const rects = [...anchor.getClientRects()];
      const rect = rects.find((r) => point && point.y >= r.top && point.y <= r.bottom) || rects[rects.length - 1] || anchor.getBoundingClientRect();
      const x = Math.min(window.innerWidth - popover.offsetWidth - 8, rect.right + 8);
      const y = Math.max(8, Math.min(window.innerHeight - popover.offsetHeight - 8, rect.top + rect.height / 2 - popover.offsetHeight / 2));
      popover.style.left = `${Math.max(8, x)}px`;
      popover.style.top = `${y}px`;
    }
    function scheduleHidePopover() {
      clearTimeout(popoverTimer);
      popoverTimer = setTimeout(hidePopover, 260);
    }
    function hidePopover() {
      clearTimeout(popoverTimer);
      popover.hidden = true;
      popoverAnchor = null;
    }
    popover.addEventListener("pointerenter", () => clearTimeout(popoverTimer));
    popover.addEventListener("pointerleave", scheduleHidePopover);
    popover.addEventListener("click", (event) => {
      event.preventDefault();
      const anchor = popoverAnchor;
      hidePopover();
      if (anchor) onPopoverClick?.(anchor);
    });

    return {
      host,
      open,
      update,
      appendItems,
      fail,
      close,
      showPopover,
      scheduleHidePopover,
      hidePopover,
      get isOpen() { return !modal.hidden; },
      get popoverAnchor() { return popoverAnchor; },
      setInlineCss(css) { const style = root.querySelector("style[data-nmp-inline]"); if (style) style.textContent = css; }
    };
  }

  globalThis.NexusMediaPreviewViewer = { create, escapeHtml };
})();
