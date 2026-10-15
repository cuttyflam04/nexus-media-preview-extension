# Nexus Mods DOM reconnaissance (2026-10-14)

Observed in a real browser, logged out (guest). Logged-in-only areas
(notifications, "last downloaded", adult mods) still to check.

## Two coexisting layouts

| Page | Layout | Stable hooks |
|---|---|---|
| Home, game page, mod lists, search results, media lists, profiles | New (React/Tailwind, headlessui) | `data-e2eid` attributes |
| Mod page `/{game}/mods/{id}` | Legacy (server-rendered, jQuery) | ids/classes (`#mod-page-tab-images`, `li.thumb`, ...) |

Tailwind class names are unstable: never select on them. Use `data-e2eid`.

## New layout: tiles

- Mod card: `[data-e2eid='mod-tile']` (game page, `/games/{game}/mods?keyword=...` search results).
  - Image link: first `a[href*='/mods/'] img` (thumbnail on `staticdelivery`).
  - Title: `[data-e2eid='mod-tile-title']`, author: `[data-e2eid='user-link']` (`/profile/{name}`).
- Compact mod card: `[data-e2eid='mod-tile-teaser']` (header quick-search dialog, `[role='dialog']`
  in `#headlessui-portal-root`; also on game page). Link carries `data-navigable-item`.
- Media card: `[data-e2eid='media-tile']` (`/games/{game}/media`, `/profile/{name}/media`).
  - Link: `https://www.nexusmods.com/{game}/images/{id}` or `/videos/{id}`.
  - Image full size = thumbnail URL with `/thumbnails/` removed (verified 1920x1080). No fetch needed.
  - Video thumbnail = `img.youtube.com/vi/{youtubeId}/mqdefault.jpg` -> YouTube id without fetch.
- Home page (`/`) shows only `game-tile`s, no mod cards.
- New hosts: `images.nexusmods.com` (game art), `avatars.nexusmods.com`. Mod/media images remain on
  `staticdelivery.nexusmods.com`.

## Notifications (logged in, checked 2026-10-15)

- Bell panel: Headless UI popover `#headlessui-popover-panel-*` rendered **inside**
  `[data-e2eid='desktop-header']` (so header-wide link filters must not apply to it).
- Full page `/notifications/all?game={game}`: same rows.
- Row = `a[href]` to the mod (`/{game}/mods/{id}`, sometimes `?tab=files`) containing
  `img[data-testid='notification-group-image']` (56px thumbnail) and a "Mark as read" button.
- Grouped rows ("X published 2 new mods") link to a single mod.

## Legacy mod page

- Tab counters: `#mod-page-tab-images` ("Images 23"), `#mod-page-tab-videos`, ...
- Top gallery on the main page: `ul.thumbgallery li.thumb[data-src]` = **full-size** author images
  (`data-exthumbimage` = thumbnail). Counts: SkyUI 23/23, USSEP 15/16, Skyrim 202X 99/263,
  Cathedral Weathers 75/407 (tab count includes user images).
- `?tab=images` HTML does NOT contain the image list: it is loaded by AJAX
  `GET /Core/Libs/Common/Widgets/ModImagesList?RH_ModImagesList1=game_id:{g},id:{m},page_size:24,page:{n}`
  with header `X-Requested-With: XMLHttpRequest` (403 without it). Params are in inline
  `RH.out_items` JSON.
- `?tab=videos` HTML contains YouTube links: `a.mod-image[href*='youtu']`.
- About: `#description_tab_h2` (`data-game-id`, `data-mod-id`) followed by `<p>` summary.
- Author: `.sideitem` with `<h3>Uploaded by</h3><a href=".../users/{id}">name</a>` (`/users/{id}`, not `/profile/`),
  `<h3>Created by</h3>` plain text.
- Requirements: `dl.accordion dt[data-accordion-track='file_requirements']` + `<main-file-requirements
  download-links='{json}'>` custom element with a JSON `dependencies` attribute.
- Thumbnail URL formats seen: `/mods/{gameId}/images/thumbnails/{modId}/{modId}-{ts}-{rand}.png`
  and older `/mods/{gameId}/images/thumbnails/{modId}-0-{ts}.png`.

## Implications for the remake

1. Detect cards with `data-e2eid` selectors instead of size/class heuristics and `textContent` scans.
2. One fetch of the mod page gives images (top gallery, full size), description, author, requirements.
   Videos tab fetched only if wanted. Drop the `?tab=images` fetch.
3. Media tiles need no fetch at all.
4. Search = same tiles; no "any input non-empty" heuristic needed.
5. Still unknown: notifications panel (login needed), "last downloaded" text, La Confrérie.
