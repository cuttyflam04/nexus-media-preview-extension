chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "nmp-download-image") {
    if (!isAllowedImageUrl(message.url)) {
      sendResponse({ ok: false, error: "Unsupported image source." });
      return false;
    }
    chrome.downloads.download({
      url: message.url,
      filename: String(message.filename || "nexus-media.jpg").slice(0, 180),
      saveAs: false
    }).then(
      (downloadId) => sendResponse({ ok: true, downloadId }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }

  if (message?.type === "nmp-fetch-image") {
    if (!isAllowedImageUrl(message.url)) {
      sendResponse({ ok: false, error: "Unsupported image source." });
      return false;
    }
    fetch(message.url, { credentials: "include" })
      .then((response) => {
        if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
        return response.blob();
      })
      .then(async (blob) => ({
        ok: true,
        type: blob.type || "image/png",
        data: arrayBufferToBase64(await blob.arrayBuffer())
      }))
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

function isAllowedImageUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (
      url.hostname === "www.nexusmods.com" ||
      url.hostname === "staticdelivery.nexusmods.com"
    );
  } catch {
    return false;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}
