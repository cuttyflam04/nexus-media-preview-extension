# Nexus Media Preview

Preview a mod's screenshots, videos, description and requirements without leaving the Nexus Mods page you are on.

## Features

- **Camera button** on mod cards (lists, search results, quick-search dialog) and on media cards.
- **Quick Look**: hover a mod, a media card or a mod link and press `Space`. Press `Space` again to close.
- **Hover peek**: rest the pointer on a mod card and its picture flips through the mod's screenshots.
- **Link popover**: hovering a link to a mod or a Nexus image/video shows a small *Preview* button.
- **Screenshots first**: gallery and full-size lightbox (wheel zoom, drag-to-pan, double-click zoom) for images; the mod's YouTube videos sit in their own section below.
- **Mod details**: author, downloads, endorsements, short description, Nexus and off-site requirements, and your last download date when Nexus shows it.
- **Posts card**: open the mod's latest threads in a card beside the preview; it follows you from mod to mod.
- **Browse without closing**: previous/next mod in the header (`Alt+←` / `Alt+→`) follows the cards on the page.
- **Image actions**: copy, download, open in a new tab.
- **Cinema mode for media**: on Media pages, profile Media tabs and media links, a near-fullscreen view walks the whole grid (images and videos) with the post's details beside it.

## Keyboard

| Key | Action |
|---|---|
| `Space` | Open the preview of what is under the pointer / close it |
| `←` `→` | Previous / next screenshot |
| `Alt+←` `Alt+→` | Previous / next mod on the page |
| `Enter` | Open the current image full size |
| `+` `-` `0` | Zoom in / out / reset (full size view) |
| `Esc` | Close the full size view, then the preview |

All shortcuts can be turned off in the options.

## Installation

The Chrome package is named `nexus-media-preview-<version>-chrome.zip`. Extract it before selecting **Load unpacked**.

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose the extracted extension folder, or use the source folder `nexus-media-preview-extension`.
5. Reload any open Nexus Mods tabs.

Open **Details → Extension options** to configure the displayed metadata and videos, action buttons, opening mode, keyboard shortcuts, and preview width. Changes are saved automatically.

### Firefox (temporary manual installation)

1. Open `about:debugging`.
2. Select **This Firefox**.
3. Select **Load Temporary Add-on...**.
4. Open the extracted `nexus-media-preview-<version>-firefox.zip` package and select its `manifest.json` file.
5. Reload any open Nexus Mods tabs.

Firefox temporary add-ons are removed when Firefox restarts. Load the package again after restarting the browser. Firefox 121 or newer is recommended.

### Store status

Official Chrome Web Store and Firefox Add-ons publication is currently delayed because developer registration and publisher verification are not available from Senegal. This is a regional payment and verification limitation, not a project restriction. Support reference: `4-5279000041139`. No fake billing information, address, country, or publisher identity should be used. The project remains compatible with both stores and can be submitted when an eligible publisher account becomes available.

The latest clean browser packages can be generated locally with `scripts/package-distributions.ps1`, or downloaded from the GitHub Actions artifact produced by the **Build browser packages** workflow.

### Feedback and support

Use GitHub Issues to report bugs, request features, or send broader feedback and complaints:

- [Report a bug](https://github.com/cuttyflam04/nexus-media-preview-extension/issues/new?template=bug_report.yml)
- [Request a feature](https://github.com/cuttyflam04/nexus-media-preview-extension/issues/new?template=feature_request.yml)
- [Send feedback or a complaint](https://github.com/cuttyflam04/nexus-media-preview-extension/issues/new?template=feedback.yml)

If the extension is useful, optional development support is available at [Ko-fi](https://ko-fi.com/cuttyflam04). It does not affect issue handling or feature prioritization.

### Browser support

- Chrome, Brave, and Edge use the Manifest V3 service worker.
- Firefox uses the same background file through the Manifest V3 `scripts` fallback. Firefox 121 or newer is recommended.
- The extension must be packaged and signed separately for each browser store.

## How it works

- Nothing scans the page. Targets are resolved from the element under the pointer (or keyboard focus) with Nexus's stable `data-e2eid` attributes; the camera button is added on first hover only.
- A mod preview makes one request (the mod page) plus one for its Videos tab when it has videos. Results are cached for the lifetime of the page.
- Requests reuse your current Nexus session: authentication, adult-content settings and page availability still apply.
- The viewer is rendered in a shadow root, so site styles and the extension's styles never mix.
- See [docs/recon-nexus.md](docs/recon-nexus.md) for the page structures the extension relies on.

## Development

- No dependencies and no build step: load the folder unpacked.
- `node --test` runs the unit tests (Node 22+).
- `scripts/package-distributions.ps1` builds the Chrome and Firefox ZIP files into `dist/`.

See [CHANGELOG.md](CHANGELOG.md) for the version history.
