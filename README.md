# SillyTavern Tool Box

A modular SillyTavern extension that bundles multiple features, each of which can be individually enabled or disabled from the extension settings panel.

## Features

### Context Panel

Detects messages containing the trigger pattern `以下是用户...` and renders an interactive context panel with:

- Parsed user input (`<本轮用户输入>` tag)
- Memory recall from AutoCardUpdaterAPI (`<recall>` tag with AM codes)
- Supplement information (`<supplement>` tag with categorized items)
- Loading statistics (memory count, load time)

## Installation

1. In SillyTavern, go to **Extensions** panel
2. Click **Install extension**
3. Enter the repo URL: `https://github.com/simonxluo/SillyTavern-tool-box`
4. Reload the page

## Usage

After installation, a **Tool Box** section appears in the Extensions settings panel. Each feature has an on/off toggle.

If you were using a regex script for context panel rendering, disable it before enabling this feature.

## Requirements

- SillyTavern 1.12+
- AutoCardUpdaterAPI (for Context Panel memory recall functionality)

## Adding New Features

To add a new feature to Tool Box:

1. Create a directory under `features/your-feature/`
2. Implement `index.js` with `export async function init()` and optional `export function destroy()`
3. Add an entry to the `FEATURES` array in the main `index.js`
4. Add any feature-specific CSS to `style.css`

## Development

```bash
# Clone
git clone https://github.com/simonxluo/SillyTavern-tool-box.git

# Install into SillyTavern for testing
# Symlink or copy to public/scripts/extensions/third-party/tool-box/
```
