---
name: zip-package
description: Zip the Chrome extension for uploading to the Chrome Web Store. Use when the user says "zip", "package", "build", "zip for store", or asks to create a zip for upload.
---

# Zip Package

Creates a `.zip` file of the extension ready for Chrome Web Store upload.

## Workflow

1. **Read `manifest.json`** to get the current version
2. **Determine output path**: use the user-specified directory, or `~/Desktop/` by default
3. **Create zip** named `zen-launcher-vX.Y.Z.zip` at the output path:

```bash
cd /Users/paunin/Sites/zen-launcher && zip -r ~/Desktop/zen-launcher-vX.Y.Z.zip \
  manifest.json \
  newtab.html \
  newtab.css \
  js/ \
  icons/ \
  -x "*.DS_Store"
```

4. **Report** the output filename, path, and size

## What to include

- `manifest.json`
- `newtab.html`
- `newtab.css`
- `js/` (all JavaScript files)
- `icons/` (extension icons)

## What to exclude

- `.git/`, `.github/`, `.cursor/`
- `images/` (screenshots, not part of the extension)
- `README.md`, `LICENSE`
- `.DS_Store`
- Any existing `.zip` files
- Any `node_modules/` or build artifacts
