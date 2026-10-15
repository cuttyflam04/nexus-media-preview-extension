const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadSources() {
  const context = { globalThis: {}, URL };
  vm.runInNewContext(fs.readFileSync("src/sources.js", "utf8"), context);
  return context.globalThis.NexusMediaPreviewSources;
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("parses Nexus mod links and ignores game hubs", () => {
  const { parseModUrl } = loadSources();

  assert.deepEqual(plain(parseModUrl("https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files")), {
    site: "nexus",
    game: "skyrimspecialedition",
    modId: "12604",
    url: "https://www.nexusmods.com/skyrimspecialedition/mods/12604"
  });
  assert.equal(parseModUrl("/skyrim/mods/95800", "https://www.nexusmods.com/skyrimspecialedition/mods/17230").url, "https://www.nexusmods.com/skyrim/mods/95800");
  assert.equal(parseModUrl("https://www.nexusmods.com/games/skyrimspecialedition/mods?keyword=x"), null);
  assert.equal(parseModUrl("https://www.nexusmods.com/skyrimspecialedition/mods/12604/edit"), null);
  assert.equal(parseModUrl("https://example.com/skyrimspecialedition/mods/1"), null);
});

test("parses Nexus media links", () => {
  const { parseMediaUrl, parseAnyUrl } = loadSources();

  assert.deepEqual(plain(parseMediaUrl("https://www.nexusmods.com/skyrimspecialedition/videos/41397")), {
    site: "nexus-media",
    kind: "video",
    url: "https://www.nexusmods.com/skyrimspecialedition/videos/41397"
  });
  assert.equal(parseMediaUrl("https://www.nexusmods.com/skyrimspecialedition/images/317495").kind, "image");
  assert.equal(parseAnyUrl("https://www.confrerie-des-traducteurs.fr/skyrim/mods/5037/audio/x"), null);
  assert.equal(parseAnyUrl("https://www.nexusmods.com/profile/someone"), null);
});

test("extracts YouTube ids from links, embeds and thumbnails", () => {
  const { youtubeId } = loadSources();

  assert.equal(youtubeId("https://youtu.be/85Jjr_siy9w"), "85Jjr_siy9w");
  assert.equal(youtubeId("https://www.youtube.com/watch?v=VaFN2nAkGh0&t=3"), "VaFN2nAkGh0");
  assert.equal(youtubeId("https://www.youtube.com/embed/7Hrkv7VPWdg"), "7Hrkv7VPWdg");
  assert.equal(youtubeId("https://img.youtube.com/vi/7Hrkv7VPWdg/mqdefault.jpg"), "7Hrkv7VPWdg");
  assert.equal(youtubeId("https://www.youtube.com/channel/UCpUcyVtYtlpjPlJrhv3IcfQ"), null);
  assert.equal(youtubeId("not a url"), null);
});

test("maps Nexus thumbnails to full-size images", () => {
  const { fullImageUrl } = loadSources();

  assert.equal(
    fullImageUrl("https://staticdelivery.nexusmods.com/images/1704/thumbnails/94011133-1792013573.png"),
    "https://staticdelivery.nexusmods.com/images/1704/94011133-1792013573.png"
  );
  assert.equal(
    fullImageUrl("https://staticdelivery.nexusmods.com/mods/1704/images/thumbnails/12604/12604-1774526205-321078529.png"),
    "https://staticdelivery.nexusmods.com/mods/1704/images/12604/12604-1774526205-321078529.png"
  );
});

test("cleans site suffixes from page titles", () => {
  const { cleanTitle } = loadSources();

  assert.equal(cleanTitle("SkyUI at Skyrim Special Edition Nexus - Mods and Community"), "SkyUI");
  assert.equal(cleanTitle("  Kick over   enemies - Nexus Mods"), "Kick over enemies");
});
