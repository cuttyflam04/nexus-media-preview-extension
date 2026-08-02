# Nexus Mods Media Preview

Preview a mod's images and YouTube videos without leaving the current Nexus Mods listing.

## Features

- Media button on mod cards, search results, profile mod listings, and profile Media grids.
- Hover/focus Media button for standalone mod and Nexus media links, including Requirements and notification links, without changing the text layout.
- In-page image gallery with thumbnails and previous/next navigation.
- Enlarged image view with blur backdrop, zoom controls, mouse wheel zoom, and keyboard navigation.
- Embedded YouTube videos detected on the mod description and Videos pages.
- Expandable mod summary and Requirements panels.
- Copy, download, open-image, and open-on-Nexus actions.
- Linked mod title that opens the mod page in a new tab.
- Compact header cards for the mod author profile and Nexus-provided total downloads when available.
- Exact last-download date when Nexus provides its own download-history sentence. Unknown states remain hidden.

The extension does not create download or endorsement data. Endorsement controls were removed in version 1.12.0.

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

## Usage

- Select the camera button on a mod/media card, or hover/focus a standalone mod/media link and select the floating **Media** button.
- Use the header arrows to move between mods visible on the current page.
- Use the gallery arrows or `Left` and `Right` to change images.
- Select the large image to open the enlarged view.
- In the enlarged view, use the controls, mouse wheel, `+`, `-`, or `0` to adjust zoom.
- Press `Escape` to close the enlarged view, then press it again to close the gallery.

## Notes

- Nexus authentication, adult-content settings, and page availability still apply.
- Media and metadata requests reuse the current Nexus session and are cached for the page lifetime.
- The extension only treats an exact Nexus download-history sentence as proof of a previous download.
- If Nexus changes its page markup, some media or metadata may become unavailable without affecting normal site navigation.

## Version 1.13.18

- Uses only the canonical mod request for metadata to keep Nexus navigation responsive; no secondary Description-tab request is made.

## Version 1.13.17

- Avoids a second full Nexus page request for normal previews; the Description-tab fallback now runs only when the canonical page has no usable summary.

## Version 1.13.16

- Extracts only Nexus's short Description paragraph under “About this mod”; the long author-provided page content is no longer inserted into the preview card.

## Version 1.13.15

- Loads metadata from both the canonical mod page and its Description tab, so Description and Requirements remain available when a preview starts from a Files-tab link.

## Version 1.13.14

- Extracts the complete Nexus description container instead of the truncated SEO summary, with a metadata fallback for older layouts.

## Version 1.13.13

- Preserves Files-tab dependencies even when Nexus exposes a normalized anchor property without its raw query string.

## Version 1.13.12

## Version 1.13.11

## Version 1.13.10

## Version 1.13.9

## Version 1.13.8

- Resets the Requirements card when switching to another mod, preventing a previously expanded list from reappearing while the new metadata loads.

## Version 1.13.7

- Adds a compact chevron toggle at the top-right of Description and Requirements cards; expansion is instant and keeps the full content in the main scroll area.

## Version 1.13.6

- Detects Nexus requirement links rendered across nested requirement containers, including links that target a mod's Files tab.

## Version 1.13.5

- Stops and unloads embedded YouTube players when the preview is closed.

## Version 1.13.4

- Keeps Requirements as individual link cards and makes Description/Requirements compact clickable cards that open instantly to their full content without an inner scroll or slide animation.

## Version 1.13.3

- Replaces the collapsible Description and Requirements controls with full static cards inside the main scroll area.

## Version 1.13.2

- Removes the unused light-theme option so the preview keeps a consistent dark presentation.

## Version 1.13.0

- Adds a persistent Options page for Description, Author, Requirements, YouTube, Nexus video media, action buttons, keyboard shortcuts, opening mode, and preview width.
- Applies preference changes to open previews without removing existing media or navigation features.

## Version 1.12.16

- Falls back to the measured result-card structure when Nexus omits search metadata entirely, so the camera appears consistently in portal search grids on mod pages.

## Version 1.12.15

- Detects portal-based search results on mod pages from the active query field, even when the result grid is rendered outside the search input's DOM subtree.
- Prevents generic notification rows that resemble mod cards from receiving the card camera overlay.

## Version 1.12.14

- Detects search panels on mod pages through their owned input field even when Nexus omits semantic search classes or roles.
- Removes stale camera overlays when a previously scanned element is later identified as a non-search row.

## Version 1.12.13

- Restricts the camera overlay to real search contexts, including the search dialog field, while leaving generic notification/activity rows on the floating **Media** control.

## Version 1.12.12

- Restricted camera-style injection to identifiable search-result contexts so generic notification/activity rows always use the floating **Media** link control.

## Version 1.12.11

- Prevented the camera-style search-card button from being injected into notification rows; notification mod/media links keep the floating **Media** control.

## Version 1.12.10

- Search-card preview buttons now retry when result images finish loading or when the search panel changes visibility, making their appearance deterministic across repeated searches.

## Version 1.12.9

- Author data now comes only from the fetched Nexus mod page, prioritizing the displayed `Uploaded by` label and then `Created by`.
- Removed source-card author fallback so search results, notifications, and the signed-in user area cannot supply the wrong author.
- Search result media buttons are now attached to the result card itself with a dedicated visible overlay class.

## Version 1.12.8

- Added a dedicated image-based pass for Nexus search results so media buttons appear on compact search cards.
- Shows the author card immediately from the clicked card/notification when Nexus exposes a profile link there, then refines it from the mod page when available.
- Reworked the preview header so title, author, download count, and action buttons stay grouped predictably.

## Version 1.12.7

- Limited compact-card detection so the extension does not attach controls to large Nexus containers.
- Debounced DOM scanning through `requestAnimationFrame` and guarded injection errors to avoid disrupting Nexus page behavior.

## Version 1.12.6

- Restored safe Description text extraction so page scripts and footer text do not appear in the viewer.
- Made the author control an icon-only header action and removed the unsafe fallback that could pick the signed-in user profile.
- Restored media buttons on compact Nexus search result cards with a structure-based card fallback.

## Version 1.12.5

- Added compact author and total-download cards to the preview header using Nexus page data.
- Limited the mod-title link hit area to the visible title text so header actions do not overlap.
- Added a broader description extractor, later narrowed in 1.12.6 after Nexus page noise leaked into the viewer.

## Version 1.12.4

- Fixed previous/next mod navigation for previews opened from standalone mod links on mod pages.
- Kept media-card pages on the dedicated corner camera button and suppressed the redundant floating Media popover there.
- Positioned the floating Media button near the cursor or visible link text for wide table links.

## Version 1.12.3

- Added dynamic floating Media support for Nexus image/video links, including notifications and profile media links.
- Media links now open the same viewer as mod links, using the linked media page instead of requiring a mod card.

## Version 1.12.2

- Restored the floating Media button for standalone text links so dense mod lists keep their original layout.
- Removed the repeated inline icon placement from link-heavy mod descriptions.

## Version 1.12.1

- Finished the inline-link control and removed the obsolete hover popover.
- Fixed video discovery being skipped on mods with many images.
- Added robust YouTube URL and lazy-iframe detection.
- Completed Requirements and enlarged-view styling and navigation.
- Removed fabricated "Not Downloaded Yet" states and duplicate metadata requests.
- Removed editor-only notes and repaired the English documentation.
