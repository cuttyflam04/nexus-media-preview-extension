(() => {
  function stopEmbeddedVideos(root) {
    if (!root?.querySelectorAll) return;
    for (const iframe of root.querySelectorAll("iframe")) {
      iframe.setAttribute("src", "about:blank");
    }
  }

  globalThis.NexusMediaPreviewMediaLifecycle = { stopEmbeddedVideos };
})();
