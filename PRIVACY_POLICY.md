# Privacy Policy for Bookmark Butler

Effective date: March 20, 2026

Bookmark Butler is a browser extension for saving, searching, and organizing bookmarks. This Privacy Policy explains what data the extension accesses, how that data is used, and what does and does not leave the user's device.

## Summary

Bookmark Butler is designed to work locally in the browser.

- We do not require account registration.
- We do not collect personal information.
- We do not sell user data.
- We do not transmit bookmark libraries, page URLs, tags, pins, or query history to our servers.
- We do not use analytics, advertising SDKs, tracking pixels, or remote profiling tools.

## Data the Extension Accesses

The extension may access the following data only to provide its core functionality:

- Bookmark data available through the browser bookmarks API, including bookmark titles, URLs, folders, and bookmark structure.
- The title and URL of the current active tab when the user explicitly opens the extension to save or manage the current page.
- Local extension settings and metadata stored on the device, such as interface language, theme preferences, pins, tags, cached bookmark data, and local query history.

## How Data Is Used

The extension uses local browser APIs to provide these features:

- Save the current page as a bookmark.
- Search bookmarks and folders.
- Rank results based on local usage signals.
- Let users pin bookmarks and folders.
- Let users create and manage tags.
- Export and import local extension metadata backups.
- Store preferences such as theme and language.

## Data Storage

Bookmark Butler stores extension data locally on the user's device using browser storage features such as `chrome.storage.local`.

Examples of locally stored data may include:

- Language preference
- Theme mode and theme color
- Cached bookmark data
- Pinned bookmarks and folders
- Custom tags
- Tag filter statistics
- Local query history used to improve sorting and search relevance

Exported backup files are created only when the user explicitly chooses to export data.

## Data Sharing

Bookmark Butler does not sell, rent, or share personal data with third parties.

The extension does not operate its own remote data collection service for user bookmark content or local metadata.

## Permissions Explained

Bookmark Butler requests the following browser permissions:

- `bookmarks`: to read, search, create, and remove bookmarks and bookmark folders.
- `activeTab`: to read the current page title and URL when the user activates the extension.
- `storage`: to save local preferences and extension metadata on the device.
- `scripting`: to inject the extension interface into the current page after the user triggers the extension.
- `notifications`: to show a fallback notice when the extension is used on restricted browser pages.

## Restricted Pages

Browser extensions cannot run content scripts on certain restricted pages such as internal browser pages. On those pages, Bookmark Butler may open a normal browser tab or a local fallback page so the user can continue using the extension workflow. This limitation is imposed by the browser platform.

## Children's Privacy

Bookmark Butler is not directed to children under 13, and we do not knowingly collect personal information from children.

## Changes to This Policy

This Privacy Policy may be updated if the extension's functionality changes. When updates are made, the new version should be published alongside the updated extension listing and documentation.

## Contact

For privacy questions about a published version of Bookmark Butler, use the support contact or support page listed in the extension store listing.
