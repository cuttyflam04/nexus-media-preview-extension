// Preview UI: modal gallery, lightbox and link popover, all inside one shadow
// root so Nexus styles cannot affect it.
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
    play: '<path d="M8 5v14l11-7Z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    posts: '<path d="M4 5h16v11H8l-4 4Z"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  function create({ cssUrl, getSettings, onNavigate, onClose, onPopoverClick, onPosts, actions }) {
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
            <div class="strip" aria-label="Screenshots"></div>
            <section class="videos" hidden>
              <h3>YouTube <span class="video-count"></span></h3>
              <div class="player" hidden></div>
              <div class="video-grid"></div>
            </section>
          </div>
          <aside class="side"></aside>
        </section>
        <section class="posts" role="complementary" aria-label="Posts" tabindex="-1" hidden>
          <header class="posts-head">
            <h3>Posts <span class="posts-count"></span></h3>
            <a class="posts-open" target="_blank" rel="noreferrer">Open on Nexus</a>
            <button class="icon-button" type="button" data-act="close-posts" aria-label="Close posts" title="Close posts (Esc)">${icon("close")}</button>
          </header>
          <div class="posts-body"></div>
        </section>
      </div>
      <div class="lightbox" role="dialog" aria-modal="true" aria-label="Full size image" tabindex="-1" hidden>
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
    const stageWrap = $(".stage-wrap");
    const main = $(".main");
    const videoSection = $(".videos");
    const videoGrid = $(".video-grid");
    const player = $(".player");
    const side = $(".side");
    const counter = $(".counter");
    const status = $(".status");
    const lightbox = $(".lightbox");
    const lbImage = lightbox.querySelector("img");
    const popover = $(".popover");
    const postsCard = $(".posts");
    const postsBody = $(".posts-body");

    let items = [];
    let videos = [];
    let dataEmpty = {};
    let requirementsOpen = null;
    let index = 0;
    let canNavigate = false;
    let itemTitles = false;
    // Cinema mode (Nexus media posts): images and videos share the stage and
    // the strip, and the side panel describes the current post.
    let cinema = null;
    // Posts card: which mod it shows, threads already rendered, paging.
    let posts = null;
    let shiftedForPosts = false;
    let zoom = { scale: 1, x: 0, y: 0 };
    let statusTimer = 0;
    let savedOverflow = "";
    let returnFocus = null;
    let popoverTimer = 0;

    const drag = globalThis.NexusMediaPreviewModalDrag;
    drag?.attach(dialog, $(".header"));
    new MutationObserver(() => placePosts()).observe(dialog, { attributes: true, attributeFilter: ["style"] });
    window.addEventListener("resize", () => placePosts());
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
        // Long lists start folded; the owner's last choice wins for the next mods.
        const open = requirementsOpen ?? data.requirements.length <= 5;
        parts.push(`<details class="requirements"${open ? " open" : ""}><summary><h3>Requirements</h3><span class="count">${data.requirements.length}</span>${icon("chevron")}</summary><ul>${data.requirements.map((req) => `<li>${
          req.url
            ? `<a href="${escapeHtml(req.url)}" target="_blank" rel="noreferrer">${escapeHtml(req.name)}${req.offsite ? "<small>off-site</small>" : ""}</a>`
            : `<span>${escapeHtml(req.name)}</span>`
        }</li>`).join("")}</ul></details>`);
      }
      if (data.links?.length) {
        parts.push(`<section><h3>Open</h3><div class="links">${data.links.map((link) => link.action === "posts"
          ? `<button type="button" data-act="posts" aria-expanded="${!postsCard.hidden}">${icon("posts")}${escapeHtml(link.label)}</button>`
          : `<a href="${escapeHtml(link.url)}" target="${link.newTab === false ? "_self" : "_blank"}" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")}</div></section>`);
      }
      side.innerHTML = parts.join("");
      side.querySelector(".requirements")?.addEventListener("toggle", (event) => { requirementsOpen = event.target.open; });
      dialog.classList.toggle("no-side", !parts.length || getSettings().modalWidth === "compact");
      const summary = side.querySelector(".summary p");
      if (summary && summary.scrollHeight > summary.clientHeight + 2) side.querySelector(".more").hidden = false;
    }

    function renderStrip() {
      strip.hidden = items.length < 2;
      strip.innerHTML = items.map((item, i) => `
        <button class="thumb" type="button" data-index="${i}" aria-label="${item.type === "video" ? "Video" : "Image"} ${i + 1}">
          <img src="${escapeHtml(item.thumb || item.src)}" alt="" loading="lazy">
          ${item.type === "video" ? `<span class="play">${icon("play")}</span>` : ""}
        </button>`).join("");
    }

    // Videos live in their own section under the gallery, so arrow keys and
    // the counter only walk through screenshots.
    function renderVideos() {
      videoSection.hidden = !videos.length;
      videoSection.querySelector(".video-count").textContent = videos.length;
      player.hidden = true;
      player.innerHTML = "";
      videoGrid.innerHTML = videos.map((video, i) => `
        <button class="video-card" type="button" data-video="${i}" aria-label="Play ${escapeHtml(video.title)}">
          <span class="video-thumb"><img src="${escapeHtml(video.thumb)}" alt="" loading="lazy"><span class="play">${icon("play")}</span></span>
          <span class="video-title">${escapeHtml(video.title)}</span>
        </button>`).join("");
    }

    function playVideo(i, reveal = false) {
      const video = videos[i];
      if (!video) return;
      player.hidden = false;
      player.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(video.id)}?autoplay=1" title="${escapeHtml(video.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      videoGrid.querySelectorAll(".video-card").forEach((card) => card.classList.toggle("is-active", Number(card.dataset.video) === i));
      if (reveal) {
        // Scroll the main column only (scrollIntoView would also move the page).
        main.scrollTop += videoSection.getBoundingClientRect().top - main.getBoundingClientRect().top - 12;
      }
    }

    function show(i) {
      if (!items.length) return;
      index = (i + items.length) % items.length;
      const item = items[index];
      // Blurred copy behind the picture fills the letterbox (portraits).
      stageWrap.style.setProperty("--stage-bg", `url(${JSON.stringify(item.thumb || item.src)})`);
      stage.classList.toggle("is-video", item.type === "video");
      if (item.type === "video") {
        stage.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(item.id)}?autoplay=1" title="${escapeHtml(item.title || item.caption || "Video")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      } else {
        stage.innerHTML = `<img class="is-loading" alt="${escapeHtml(item.caption || "")}">`;
        const img = stage.firstElementChild;
        img.onload = img.onerror = () => img.classList.remove("is-loading");
        img.src = item.src;
      }
      // Warm the neighbours so arrow navigation feels instant.
      for (const near of [items[index + 1], items[index - 1]]) if (near?.type === "image") new Image().src = near.src;
      counter.textContent = `${index + 1} / ${items.length}`;
      if (itemTitles) {
        title.textContent = item.caption || "Nexus media";
        title.href = item.pageUrl || title.href;
      }
      root.querySelectorAll(".arrow").forEach((arrow) => { arrow.hidden = items.length < 2; });
      $(".tools").hidden = item.type !== "image" || !getSettings().showActionButtons;
      if (cinema) renderMediaInfo(item);
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

    function renderMediaInfo(item, details) {
      const settings = getSettings();
      const d = details || {};
      const author = d.author || item.author;
      renderChips([
        settings.showAuthor && author ? { icon: "user", label: author.name, url: author.url, title: "Uploader" } : null,
        item.endorsements ? { icon: "heart", label: item.endorsements, title: "Endorsements" } : null,
        item.views ? { icon: "eye", label: `${item.views} views` } : null,
        d.date ? { icon: "calendar", label: d.date } : null
      ]);
      const parts = [];
      if (!details) parts.push('<section><h3>About</h3><div class="skeleton"></div><div class="skeleton"></div></section>');
      else if (settings.showDescription && d.description) parts.push(`<section class="summary is-open"><h3>About</h3><p>${escapeHtml(d.description)}</p></section>`);
      if (d.mods?.length) {
        parts.push(`<section class="requirements"><h3>Mods in this video</h3><ul>${d.mods.map((mod) => `<li><a href="${escapeHtml(mod.url)}" target="_blank" rel="noreferrer">${escapeHtml(mod.name)}</a></li>`).join("")}</ul></section>`);
      }
      const links = [
        item.pageUrl ? { label: item.type === "video" ? "Video page" : "Image page", url: item.pageUrl } : null,
        d.moreUrl ? { label: "More from uploader", url: d.moreUrl } : null
      ].filter(Boolean);
      if (links.length) parts.push(`<section><h3>Open</h3><div class="links">${links.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")}</div></section>`);
      side.innerHTML = parts.join("");
      if (!details && cinema?.describe) {
        cinema.describe(item).then((loaded) => {
          if (items[index] === item) renderMediaInfo(item, loaded || {});
        }, () => {
          if (items[index] === item) renderMediaInfo(item, {});
        });
      }
    }

    // ---------- Posts card ----------
    function renderPost(post, author) {
      const isAuthor = author && post.name.toLowerCase() === author.toLowerCase();
      const badge = post.sticky ? '<span class="badge is-pinned">Pinned</span>' : isAuthor ? '<span class="badge is-author">Author</span>' : "";
      const replies = post.replies?.length
        ? `<button class="replies-toggle" type="button" data-act="replies" aria-expanded="false">${post.replies.length} ${post.replies.length === 1 ? "reply" : "replies"}</button>
           <ol class="replies" hidden>${post.replies.map((reply) => `<li>${renderPost(reply, author)}</li>`).join("")}</ol>`
        : "";
      return `<article class="post${post.sticky ? " is-sticky" : ""}${isAuthor ? " is-author" : ""}">
        <header>
          ${post.avatar ? `<img class="avatar" src="${escapeHtml(post.avatar)}" alt="" loading="lazy">` : '<span class="avatar"></span>'}
          <span class="who">${post.url ? `<a href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer">${escapeHtml(post.name)}</a>` : escapeHtml(post.name)}${badge}</span>
          <time>${escapeHtml(post.date || "")}</time>
        </header>
        <p class="post-text">${escapeHtml(post.text || "")}</p>
        <button class="more" type="button" data-act="post-more" hidden>Show more</button>
        ${replies}
      </article>`;
    }

    function markLongPosts(scope) {
      scope.querySelectorAll(".post-text").forEach((text) => {
        const more = text.nextElementSibling;
        if (more?.dataset.act === "post-more") more.hidden = text.scrollHeight <= text.clientHeight + 2;
      });
    }

    function placePosts(allowShift = false) {
      if (postsCard.hidden) return;
      const gap = 12;
      const margin = 16;
      const width = Math.min(400, window.innerWidth - margin * 2);
      let box = dialog.getBoundingClientRect();
      // Make room on the right by sliding the preview left when the pair fits.
      if (allowShift && window.innerWidth - box.right - margin < width + gap && box.width + gap + width <= window.innerWidth - margin * 2) {
        dialog.style.left = `${Math.round((window.innerWidth - box.width - gap - width) / 2)}px`;
        dialog.style.top = `${Math.round(box.top)}px`;
        dialog.style.transform = "none";
        shiftedForPosts = true;
        box = dialog.getBoundingClientRect();
      }
      const beside = window.innerWidth - box.right - margin >= width + gap;
      postsCard.classList.toggle("is-overlay", !beside);
      postsCard.style.width = `${width}px`;
      postsCard.style.top = `${Math.round(beside ? box.top : box.top + 8)}px`;
      postsCard.style.height = `${Math.round(beside ? box.height : box.height - 16)}px`;
      postsCard.style.left = `${Math.round(beside ? box.right + gap : box.right - width - 8)}px`;
    }

    function openPosts(info) {
      posts = { key: info.key, author: info.author || null, seen: new Set(), loading: true };
      postsCard.hidden = false;
      postsCard.querySelector(".posts-count").textContent = info.total ? info.total.toLocaleString("en") : "";
      const open = postsCard.querySelector(".posts-open");
      open.href = info.url;
      postsBody.innerHTML = '<div class="spinner" role="status" aria-label="Loading posts"></div>';
      side.querySelector("[data-act='posts']")?.setAttribute("aria-expanded", "true");
      placePosts(true);
    }

    function addPosts(key, data) {
      if (!posts || posts.key !== key) return;
      posts.loading = false;
      if (data.total) postsCard.querySelector(".posts-count").textContent = data.total.toLocaleString("en");
      const fresh = data.threads.filter((thread) => !posts.seen.has(thread.id));
      fresh.forEach((thread) => posts.seen.add(thread.id));
      postsBody.querySelector(".spinner")?.remove();
      postsBody.querySelector(".load-more")?.remove();
      if (!posts.seen.size) {
        postsBody.innerHTML = '<div class="empty"><strong>No posts yet</strong></div>';
        return;
      }
      postsBody.insertAdjacentHTML("beforeend", fresh.map((thread) => renderPost(thread, posts.author)).join(""));
      if (data.hasMore) postsBody.insertAdjacentHTML("beforeend", '<button class="load-more" type="button" data-act="more-posts">Load more</button>');
      markLongPosts(postsBody);
    }

    function failPosts(key, message) {
      if (!posts || posts.key !== key) return;
      postsBody.querySelector(".spinner")?.remove();
      postsBody.querySelector(".load-more")?.remove();
      postsBody.insertAdjacentHTML("beforeend", `<div class="empty"><strong>Could not load posts</strong><span>${escapeHtml(message)}</span></div>`);
    }

    function closePosts() {
      if (postsCard.hidden) return;
      postsCard.hidden = true;
      postsBody.innerHTML = "";
      posts = null;
      side.querySelector("[data-act='posts']")?.setAttribute("aria-expanded", "false");
      if (shiftedForPosts) drag?.reset(dialog);
      shiftedForPosts = false;
    }

    function renderEmpty(message, detail, url) {
      items = [];
      stageWrap.style.removeProperty("--stage-bg");
      stage.classList.add("is-video");
      stage.innerHTML = `<div class="empty"><strong>${escapeHtml(message)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ""}${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open the page</a>` : ""}</div>`;
      strip.innerHTML = "";
      strip.hidden = true;
      counter.textContent = "";
      $(".tools").hidden = true;
      root.querySelectorAll(".modal .arrow").forEach((arrow) => { arrow.hidden = true; });
    }

    function renderNoImages() {
      if (videos.length) renderEmpty("No screenshots", "This one only has videos, right below.");
      else renderEmpty(dataEmpty.message || "No media found", dataEmpty.detail, dataEmpty.url);
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
      cinema = null;
      if (entry.mode === "cinema") closePosts();
      dialog.classList.toggle("cinema", entry.mode === "cinema");
      canNavigate = Boolean(entry.canNavigate);
      $("[data-act='prev-mod']").parentElement.hidden = !canNavigate;
      title.textContent = entry.title || "Loading…";
      title.href = entry.url || "#";
      renderChips(entry.chips);
      items = [];
      videos = [];
      renderVideos();
      main.scrollTop = 0;
      stage.classList.add("is-video");
      stageWrap.style.removeProperty("--stage-bg");
      stage.innerHTML = '<div class="spinner" role="status" aria-label="Loading"></div>';
      strip.innerHTML = "";
      counter.textContent = "";
      $(".tools").hidden = true;
      renderSide({ loading: entry.site !== "nexus-media" });
      if (modal.hidden) {
        returnFocus = deepActiveElement();
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
      dataEmpty = { message: data.emptyMessage, detail: data.emptyDetail, url: data.url };
      const all = data.items || [];
      if (data.mode === "cinema") {
        cinema = { describe: data.describe };
        dialog.classList.add("cinema");
        dialog.classList.remove("no-side");
        items = getSettings().showYoutube ? all : all.filter((item) => item.type !== "video");
        videos = [];
        renderVideos();
        if (!items.length) return renderEmpty(data.emptyMessage || "No media found", data.emptyDetail, data.url);
        renderStrip();
        show(Math.max(0, items.indexOf(all[data.startIndex || 0])));
        return;
      }
      items = all.filter((item) => item.type === "image");
      videos = getSettings().showYoutube ? all.filter((item) => item.type === "video") : [];
      renderVideos();
      const start = all[data.startIndex || 0];
      if (items.length) {
        renderStrip();
        show(start?.type === "image" ? items.indexOf(start) : 0);
      } else {
        renderNoImages();
      }
      if (start?.type === "video" && videos.includes(start)) playVideo(videos.indexOf(start), true);
    }

    function appendItems(extra) {
      if (!getSettings().showYoutube) return;
      const more = extra.filter((item) => item.type === "video" && !videos.some((known) => known.id === item.id));
      if (!more.length) return;
      videos = [...videos, ...more];
      renderVideos();
      if (!items.length) renderNoImages();
    }

    function fail(message, url) {
      renderSide({});
      renderEmpty("Could not load this preview", message, url);
    }

    function close() {
      if (modal.hidden) return;
      closeLightbox();
      closePosts();
      stage.innerHTML = "";
      player.innerHTML = "";
      modal.hidden = true;
      document.documentElement.style.overflow = savedOverflow;
      // Give keyboard users their place back on the page.
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
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
      lightbox.focus({ preventScroll: true });
    }
    function closeLightbox() {
      if (lightbox.hidden) return;
      lightbox.hidden = true;
      lbImage.removeAttribute("src");
      if (!modal.hidden) stage.focus({ preventScroll: true });
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
      const card = event.target.closest(".video-card");
      if (card) return playVideo(Number(card.dataset.video), true);
      const action = event.target.closest("[data-act]")?.dataset.act;
      const item = items[index];
      switch (action) {
        case "close": return close();
        case "prev": return show(index - 1);
        case "next": return show(index + 1);
        case "prev-mod": return onNavigate?.(-1);
        case "posts": return postsCard.hidden ? onPosts?.("open") : closePosts();
        case "close-posts": return closePosts();
        case "more-posts": event.target.disabled = true; event.target.textContent = "Loading…"; return onPosts?.("more", posts?.key);
        case "post-more": event.target.previousElementSibling.classList.add("is-open"); event.target.remove(); return;
        case "replies": {
          const list = event.target.nextElementSibling;
          list.hidden = !list.hidden;
          event.target.setAttribute("aria-expanded", String(!list.hidden));
          if (!list.hidden) markLongPosts(list);
          return;
        }
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
      if (modal.hidden) return;
      const inLightbox = !lightbox.hidden;
      const key = event.key;
      // Focus containment is not a shortcut: it applies even with shortcuts off.
      if (key === "Tab") {
        const inPosts = !postsCard.hidden && postsCard.contains(root.activeElement);
        trapTab(event, inLightbox ? lightbox : inPosts ? postsCard : dialog);
        return;
      }
      if (!getSettings().keyboardShortcuts) return;
      if (!postsCard.hidden && postsCard.contains(root.activeElement) && key !== "Escape") return;
      let handled = true;
      if (key === "Escape") inLightbox ? closeLightbox() : !postsCard.hidden ? closePosts() : close();
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

    // ---------- Focus ----------
    function deepActiveElement() {
      let active = document.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      return active;
    }

    function trapTab(event, layer) {
      const focusable = [...layer.querySelectorAll("button, a[href], iframe, summary, [tabindex]:not([tabindex='-1'])")]
        .filter((node) => !node.disabled && node.getClientRects().length && !node.closest("[hidden]"));
      if (!focusable.length) return;
      const current = root.activeElement;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const outside = !layer.contains(current);
      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
      event.stopImmediatePropagation();
    }

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
      get postsOpen() { return !postsCard.hidden; },
      openPosts,
      addPosts,
      failPosts,
      closePosts,
      get popoverAnchor() { return popoverAnchor; },
      setInlineCss(css) { const style = root.querySelector("style[data-nmp-inline]"); if (style) style.textContent = css; }
    };
  }

  globalThis.NexusMediaPreviewViewer = { create, escapeHtml };
})();
