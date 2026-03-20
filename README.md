> This project was created with Vibe Coding. Review, test, and polish the code and store assets before publishing.

# Bookmark Butler

![License](https://img.shields.io/badge/license-GPLv3-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)
![Install](https://img.shields.io/badge/install-unpacked%20extension-orange.svg)

Bookmark Butler is a Chrome-compatible bookmark manager focused on fast saving, quick search, and lightweight organization. It opens directly on the current page, lets you search folders or bookmarks, and helps you keep large bookmark libraries manageable without sending data to external services.

> The extension is not published to the Chrome Web Store yet. For now, load it unpacked in developer mode or package it for your own store submission.

## Features

- Quickly save the current page into any bookmark folder.
- Search bookmarks and folders in the same interface.
- Rank folders intelligently with bookmark metadata and recent usage signals.
- Pin important folders or bookmarks to keep them near the top.
- Organize bookmarks and folders with custom tags.
- Filter results by item type and tag.
- Export and import local extension metadata, including tags, pins, and search history.
- Switch theme mode, accent color, and interface language.
- Navigate efficiently with keyboard shortcuts and virtualized lists.

## Installation

### Load unpacked

1. Download or clone this repository.
2. Open `chrome://extensions/`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select this project folder.

### Package for store submission

1. Finalize your branding assets, screenshots, and store copy.
2. Open `chrome://extensions/`.
3. Use `Pack extension` to generate a distributable package.
4. Upload the package to the target extension store.
5. Submit the listing with permissions rationale and privacy disclosure.

## Usage

1. Open any regular webpage.
2. Click the extension icon, or assign your own shortcut in `chrome://extensions/shortcuts`.
3. Search folders or bookmarks in the modal.
4. Choose a target folder to save the current page, or browse existing bookmarks.
5. Use tags, pins, filters, and keyboard navigation to manage results faster.

## Permissions

- `bookmarks`: Read, create, search, and remove bookmarks and bookmark folders.
- `activeTab`: Read the current tab title and URL when the user opens the extension.
- `storage`: Save preferences and local metadata such as theme, language, tags, pins, cache, and query history.
- `scripting`: Inject the modal UI into the active page when the user triggers the extension.
- `notifications`: Show a fallback notice when the extension is triggered on restricted browser pages.

## Privacy

Bookmark Butler is designed to work locally in the browser.

- No account is required.
- No analytics, tracking pixels, or advertising SDKs are included.
- No bookmark data, page URLs, tags, pins, or search history are sent to our servers.
- No personal information is sold or shared with third parties.

The extension stores data only on the user's device through browser storage APIs:

- Bookmark access comes from the browser's `chrome.bookmarks` API.
- Local preferences and metadata are stored in `chrome.storage.local`.
- Exported backup files are created only when the user explicitly runs export.

Local data currently includes:

- Language preference
- Theme mode and theme color
- Cached bookmark data
- Pinned bookmarks and folders
- Custom tags and tag filter statistics
- Local query history used to improve result ranking

If the extension is triggered on restricted pages such as `chrome://` or other browser-internal URLs, it does not read page content. Instead, it falls back to a local helper flow because content scripts cannot run on those pages.

A standalone policy file for store submission is available at [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## Project Structure

```text
bookmark-butler/
├── manifest.json
├── src/
│   ├── background.js
│   ├── content-script.js
│   ├── components/
│   │   ├── keyboard-manager.js
│   │   ├── language-manager.js
│   │   ├── theme-manager.js
│   │   ├── ui-manager.js
│   │   └── virtual-scroller.js
│   ├── modal/
│   │   ├── modal-manager-core.js
│   │   ├── modal-manager-data.js
│   │   ├── modal-manager-export.js
│   │   ├── modal-manager-navigation.js
│   │   ├── modal-manager-render.js
│   │   └── modal-manager-search.js
│   ├── styles/
│   │   └── modal.css
│   └── utils/
│       ├── bookmark-api.js
│       ├── constants.js
│       ├── data-export-import.js
│       ├── helpers.js
│       ├── pin-manager.js
│       ├── query-history.js
│       ├── search-engine.js
│       ├── sorting-algorithm.js
│       └── tag-manager.js
├── icons/
└── docs/
```

## Development

Detailed technical documentation is available in [docs/REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md), [docs/COMPONENT_API.md](docs/COMPONENT_API.md), and [docs/user-guide.md](docs/user-guide.md).

### Local setup

```bash
git clone https://github.com/your-repo/bookmark-butler.git
cd bookmark-butler
```

### Available script

```bash
npm run lint
```

## Store Submission Notes

For a store listing, the current project materials already cover the main reviewer questions:

- English product name and description in `manifest.json`
- English default UI language
- Explicit permissions rationale
- Privacy disclosure stating that data stays local
- A store copy draft in `docs/chrome-store-description.md`

## License

This project is licensed under the GNU GPL v3. See [LICENSE](LICENSE) for details.
