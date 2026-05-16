# SillyTavern Context Panel Extension

A SillyTavern extension that detects messages containing the trigger pattern `以下是用户...` and renders an interactive context panel with user input, memory recall from AutoCardUpdaterAPI, and supplement information.

## Features

- Parses `<本轮用户输入>`, `<recall>`, `<supplement>` tags from message content
- Renders styled panel with collapsible sections
- Loads memory data from AutoCardUpdaterAPI (纪要表/总结表)
- Parses AM codes (e.g., AM001, AM002) and looks up corresponding entries
- Displays supplement information with categorized tags
- Shows loading statistics (memory count, load time)

## Installation

1. In SillyTavern, go to **Extensions** panel
2. Click **Install extension** (or paste the repo URL in the extension installer)
3. Enter the GitHub repo URL
4. Reload the page

## Usage

The extension automatically activates on messages containing the pattern `以下是用户`. No configuration needed.

Disable any existing regex scripts that were previously handling this pattern.

## Requirements

- SillyTavern 1.12+
- AutoCardUpdaterAPI (for memory recall functionality)
