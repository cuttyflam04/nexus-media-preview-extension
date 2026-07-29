# Publishing

## Chrome Web Store

1. Create the runtime ZIP without tests or documentation.
2. Upload it in the Chrome Web Store Developer Dashboard.
3. Increment `manifest.json` version for every code or asset update.
4. Submit the new package for review, then publish it.

Chrome distributes published updates automatically after publication.

## Firefox Add-ons

1. Upload the same cross-browser package to addons.mozilla.org.
2. Complete Mozilla's signing and listing review.
3. Publish the signed package through the AMO listing.

Firefox requires the signed package for normal user installation. The
Manifest V3 background fallback is already declared in `manifest.json`.
