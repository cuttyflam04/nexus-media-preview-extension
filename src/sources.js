// Pure parsing for Nexus Mods pages. No page side effects:
// every function takes a URL string or a parsed Document and returns data.
// Selectors come from docs/recon-nexus.md (observed on the live sites).
(() => {
  const NEXUS_HOST = "www.nexusmods.com";

  function toUrl(href, base) {
    try {
      return new URL(href, base || globalThis.location?.href || "https://www.nexusmods.com/");
    } catch {
      return null;
    }
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function cleanTitle(value) {
    return cleanText(value)
      .replace(/\s+at\s+.+?\s+Nexus\s+-\s+Mods.*$/i, "")
      .replace(/\s+(?:at|on|-)\s+Nexus Mods.*$/i, "");
  }

  // https://www.nexusmods.com/{game}/mods/{id} -> { game, modId, url }
  function parseModUrl(href, base) {
    const url = toUrl(href, base);
    if (!url || url.hostname !== NEXUS_HOST) return null;
    const match = url.pathname.match(/^\/([^/]+)\/mods\/(\d+)\/?$/i);
    if (!match || match[1] === "games") return null;
    return { site: "nexus", game: match[1], modId: match[2], url: `https://${NEXUS_HOST}/${match[1]}/mods/${match[2]}` };
  }

  // https://www.nexusmods.com/{game}/images/{id} or /videos/{id}
  function parseMediaUrl(href, base) {
    const url = toUrl(href, base);
    if (!url || url.hostname !== NEXUS_HOST) return null;
    const match = url.pathname.match(/^\/([^/]+)\/(images|videos)\/(\d+)\/?$/i);
    if (!match) return null;
    return {
      site: "nexus-media",
      kind: match[2].toLowerCase() === "videos" ? "video" : "image",
      url: `https://${NEXUS_HOST}/${match[1]}/${match[2].toLowerCase()}/${match[3]}`
    };
  }

  function parseAnyUrl(href, base) {
    return parseModUrl(href, base) || parseMediaUrl(href, base);
  }

  function youtubeId(href) {
    const url = toUrl(href);
    if (!url) return null;
    const host = url.hostname.replace(/^www\.|^m\./, "");
    let id = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|v|shorts|live)\/([^/?#]+)/)?.[1];
    } else if (host === "img.youtube.com" || host === "i.ytimg.com") {
      id = url.pathname.match(/^\/vi(?:_webp)?\/([^/]+)\//)?.[1];
    }
    return /^[\w-]{11}$/.test(id || "") ? id : null;
  }

  // Nexus thumbnails live next to the full image under /thumbnails/.
  function fullImageUrl(thumbUrl) {
    return String(thumbUrl || "").replace(/\/thumbnails\//, "/");
  }

  function video(id, title) {
    return { type: "video", id, title: cleanText(title) || "YouTube video", thumb: `https://img.youtube.com/vi/${id}/mqdefault.jpg` };
  }

  function dedupe(items) {
    const seen = new Set();
    return items.filter((item) => {
      const key = item.type === "video" ? `v:${item.id}` : `i:${item.src}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function textOf(node) {
    return cleanText(node?.textContent);
  }

  // Legacy (server-rendered) mod page: /{game}/mods/{id}
  function parseNexusModPage(doc, mod) {
    const headings = [...doc.querySelectorAll("h3")];
    const hasDescription = Boolean(doc.querySelector("#description_tab_h2"));
    if (!hasDescription && headings.some((h) => /adult content disabled/i.test(textOf(h)))) {
      return { blocked: "adult" };
    }

    const title = cleanTitle(doc.querySelector("meta[property='og:title']")?.content || doc.querySelector("#pagetitle h1")?.textContent);

    const images = [...doc.querySelectorAll("li.thumb[data-src]")].map((li) => {
      const img = li.querySelector("img");
      return {
        type: "image",
        src: li.getAttribute("data-src"),
        thumb: li.getAttribute("data-exthumbimage") || img?.getAttribute("src") || li.getAttribute("data-src"),
        caption: cleanText(img?.getAttribute("title") || img?.getAttribute("alt")),
        pageUrl: `${mod.url}?tab=images`
      };
    });
    if (!images.length) {
      const og = doc.querySelector("meta[property='og:image']")?.content;
      if (og && /staticdelivery\.nexusmods\.com\/mods\//.test(og)) {
        images.push({ type: "image", src: fullImageUrl(og), thumb: og, caption: "", pageUrl: `${mod.url}?tab=images` });
      }
    }

    const sideItem = (label) => headings
      .find((h) => new RegExp(`^${label}$`, "i").test(textOf(h)))
      ?.closest(".sideitem");
    const uploader = sideItem("Uploaded by")?.querySelector("a[href]");
    const creator = sideItem("Created by");
    const creatorName = creator ? cleanText(textOf(creator).replace(/^Created by\s*/i, "")) : "";
    const authorName = creatorName || textOf(uploader);
    const author = authorName ? { name: authorName, url: uploader?.href || null } : null;

    const requirements = headings
      .filter((h) => /requirements$/i.test(textOf(h)) && h.closest(".tabbed-block"))
      .flatMap((h) => [...h.closest(".tabbed-block").querySelectorAll("tbody tr")].map((row) => {
        const link = row.querySelector("a[href]");
        const name = textOf(link || row.querySelector("td"));
        return name ? { name, url: link?.href || null, offsite: /off-site/i.test(textOf(h)) } : null;
      }))
      .filter(Boolean);

    const descriptionVideos = [...doc.querySelectorAll(".mod_description_container a[href], .mod_description_container iframe")]
      .map((node) => youtubeId(node.getAttribute("href") || node.getAttribute("src") || node.getAttribute("data-src")))
      .filter(Boolean)
      .map((id) => video(id, "Video from the description"));

    const lastDownload = cleanText(doc.body?.textContent).match(
      /you\s+last\s+downloaded\s+a\s+file\s+from\s+this\s+mod\s+on\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i
    )?.[1] || null;

    const videoCount = Number(textOf(doc.querySelector("#mod-page-tab-videos")).replace(/\D/g, "")) || 0;

    return {
      title,
      url: mod.url,
      summary: globalThis.NexusMediaPreviewDescription?.extract(doc, title) || null,
      author,
      // Account name that answers in the Posts tab.
      uploader: textOf(uploader) || null,
      requirements,
      lastDownload,
      videoCount,
      items: dedupe([...images, ...descriptionVideos])
    };
  }

  // /{game}/mods/{id}?tab=videos : YouTube tiles rendered server-side.
  function parseNexusVideosTab(doc) {
    return dedupe([...doc.querySelectorAll("a.mod-image[href]")]
      .map((a) => {
        const id = youtubeId(a.getAttribute("href"));
        return id ? video(id, textOf(a.querySelector(".tile-name"))) : null;
      })
      .filter(Boolean));
  }

  // /{game}/images/{id} or /{game}/videos/{id} (legacy layout). Returns the
  // media item plus the details the cinema view shows next to it.
  function parseNexusMediaPage(doc, pageUrl) {
    const title = cleanTitle(doc.querySelector("meta[property='og:title']")?.content || doc.querySelector("h1")?.textContent)
      .replace(/^(?:Screenshot|Video|Image)\s*::\s*/i, "") || "Nexus media";
    const author = doc.querySelector("#image-author-name");
    const details = {
      title,
      pageUrl,
      // Authors often leave "-" or "..." as a description: keep only real text.
      description: [cleanText((doc.querySelector("#full-image-description, .video-description") || {}).textContent)].find((text) => /[\p{L}\p{N}]/u.test(text)) || null,
      date: textOf(doc.querySelector("#fileinfo time .date")) || null,
      author: author ? { name: textOf(author), url: author.href } : null,
      moreUrl: doc.querySelector("#fileinfo a[href*='?tab=']")?.href || null,
      // Videos list the mods they show as legacy tiles.
      mods: dedupeBy([...doc.querySelectorAll(".tile-name a[href*='/mods/']")]
        .map((a) => ({ name: textOf(a), url: parseModUrl(a.href)?.url }))
        .filter((mod) => mod.name && mod.url), (mod) => mod.url)
    };

    const id = [...doc.querySelectorAll("iframe[src]")].map((f) => youtubeId(f.getAttribute("src"))).find(Boolean);
    if (id) return { ...details, url: pageUrl, items: [{ ...video(id, title), caption: title, pageUrl }] };

    // The post picture sits in a.inline-gallery; other staticdelivery images on
    // the page are news tiles.
    const og = doc.querySelector("meta[property='og:image']")?.content;
    const src = doc.querySelector("a.inline-gallery img")?.getAttribute("src")
      || [...doc.querySelectorAll("img[src]")].map((img) => img.getAttribute("src")).find((value) => /staticdelivery\.nexusmods\.com\/images\/\d+\/(?!thumbnails\/)/.test(value))
      || (og ? fullImageUrl(og) : null);
    return { ...details, url: pageUrl, items: src ? [{ type: "image", src, thumb: og || src, caption: title, pageUrl }] : [] };
  }

  // Mod posts. The ?tab=posts page renders the first page of threads; later
  // pages come from the CommentContainer widget whose parameters sit in an
  // inline RequestHelper script of that same page.
  function commentText(node) {
    if (!node) return "";
    const copy = node.cloneNode(true);
    copy.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    copy.querySelectorAll("p, div, li, blockquote").forEach((block) => block.append("\n"));
    return String(copy.textContent || "").replace(/\u00a0/g, " ").replace(/Spoiler:\s*Show\s*/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function parseComment(li) {
    const nameLink = li.querySelector(":scope > .comment-head .comment-name a");
    return {
      id: li.id.replace(/^comment-/, ""),
      name: textOf(nameLink) || "Someone",
      url: nameLink?.href || null,
      avatar: li.querySelector(":scope > .comment-head .comment-user img")?.getAttribute("src") || null,
      role: textOf(li.querySelector(":scope > .comment-head .comment-details ul li")) || null,
      date: textOf(li.querySelector(":scope > .comment-content time")) || null,
      sticky: li.classList.contains("comment-sticky"),
      text: commentText(li.querySelector(":scope > .comment-content .comment-content-text"))
    };
  }

  function parseNexusPosts(doc) {
    const threads = [...doc.querySelectorAll("li.comment")]
      .filter((li) => !li.parentElement.closest("li.comment"))
      .map((li) => ({
        ...parseComment(li),
        replies: [...li.querySelectorAll(":scope > .comment-kids > li.comment, :scope ol.comment-kids > li.comment")]
          .filter((kid, index, list) => list.indexOf(kid) === index)
          .map(parseComment)
      }));
    const pages = [...doc.querySelectorAll(".pagination a, .pagination li")]
      .map((node) => Number(textOf(node)))
      .filter(Number.isFinite);
    let widget = null;
    for (const script of doc.querySelectorAll("script")) {
      const code = script.textContent || "";
      const match = code.match(/RH\.uri = '([^']*CommentContainer)';[\s\S]*?RH\.out_items = JSON\.parse\("((?:[^"\\]|\\.)*)"\)/);
      if (match) {
        try { widget = { uri: match[1], params: JSON.parse(JSON.parse(`"${match[2]}"`)) }; } catch { widget = null; }
        break;
      }
    }
    const total = Number(textOf(doc.querySelector("#mod-page-tab-posts")).replace(/\D/g, "")) || null;
    return { threads, total, pageCount: pages.length ? Math.max(...pages) : 1, widget };
  }

  function dedupeBy(list, key) {
    const seen = new Set();
    return list.filter((entry) => !seen.has(key(entry)) && seen.add(key(entry)));
  }

  globalThis.NexusMediaPreviewSources = {
    cleanText,
    cleanTitle,
    parseModUrl,
    parseMediaUrl,
    parseAnyUrl,
    youtubeId,
    fullImageUrl,
    parseNexusModPage,
    parseNexusVideosTab,
    parseNexusMediaPage,
    parseNexusPosts
  };
})();
