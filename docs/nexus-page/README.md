# Nexus page kit (v2.0.0)

Everything needed to create the new page at https://www.nexusmods.com/site (Modding Tools).
Nothing here is published automatically: copy each field into the Nexus upload form.

## Page fields

| Field | Value |
|---|---|
| Game | Modding Tools (`site`) |
| Category | Universal Tools |
| Name | Nexus Media Preview - Quick Look for Nexus Mods |
| Version | 2.0.0 |
| Author | CuttyFlamme |
| Language | English |
| Adult content | No |
| Permissions | Open source (link the GitHub repository) |

**Brief overview / summary** (one sentence, shown under the title and on cards):

> Hover a mod and press Space: screenshots, videos, requirements and media posts open right where you are, without a new tab. Unofficial browser extension for Chrome, Edge, Brave and Firefox.

**Description**: paste `description.bbcode`. After uploading the images (next section), replace each
`IMG_XX_...` placeholder with that image's URL (Images tab → open the image → copy its address).

## Images (`images/`)

Upload in this order; the first one becomes the card thumbnail in Nexus listings.

| File | Use | Caption |
|---|---|---|
| `00-cover.jpg` | Primary image (card thumbnail) | Hover a mod, press Space. |
| `01-preview.jpg` | Gallery | Quick Look: the author's gallery, description and stats in place. |
| `02-hover-peek.jpg` | Gallery | Hover peek: a card flips through the mod's screenshots. |
| `03-requirements.jpg` | Gallery | Nexus and off-site requirements beside the gallery. |
| `04-quick-search.jpg` | Gallery | Works in the header search, even on mod pages. |
| `05-videos.jpg` | Gallery | YouTube videos below the screenshots, playing in place. |
| `06-cinema.jpg` | Gallery | Cinema mode for media pages and profiles. |
| `07-settings.jpg` | Gallery | Settings. |
| `header.jpg` (1920×480) | Page header | — |

All captures are 1920×1080, taken on the live site logged out, on safe-for-work mods. If Nexus asks
for another header size, re-render with `node tmp/cdp.mjs tmp/s-cover.mjs` after changing the size.

## Files tab

Build with `scripts/package-distributions.ps1` (outputs to `dist/`).

| File | Category | Name | Version |
|---|---|---|---|
| `nexus-media-preview-2.0.0-chrome.zip` | Main | Nexus Media Preview - Chrome, Edge, Brave | 2.0.0 |
| `nexus-media-preview-2.0.0-firefox.zip` | Main | Nexus Media Preview - Firefox | 2.0.0 |

**Chrome / Edge / Brave file description**

> For Chrome, Edge, Brave and other Chromium browsers. Extract the ZIP, open the extensions page, turn on Developer mode, then Load unpacked and pick the folder. Full steps in the Installation section of the description.

**Firefox file description**

> For Firefox 121 or newer. Extract the ZIP, open about:debugging → This Firefox → Load Temporary Add-on, and select manifest.json. Firefox unloads temporary add-ons on restart, so load it again after each restart.

## Changelog (Logs tab, version 2.0.0)

- Rewritten from scratch: nothing scans the page any more, the extension reacts only to what you hover, so browsing stays as fast as without it.
- Quick Look: Space on a hovered mod, media or link opens the preview; Space again closes it.
- Hover peek: a mod card flips through its screenshots while you rest on it.
- Cinema mode for media pages, profile Media tabs and media links.
- Works in the header search (including on mod pages) and in notifications.
- YouTube videos below the gallery; screenshots first.
- Foldable requirements, Nexus and off-site.
- Portrait screenshots letterboxed over a blurred backdrop instead of cropped.
- Keyboard and accessibility: focus stays in the preview and returns to the card; reduced motion respected.
- New settings page.
- One page request per mod instead of three.
- Removed: La Confrérie des Traducteurs support, grouped-notification guessing.
