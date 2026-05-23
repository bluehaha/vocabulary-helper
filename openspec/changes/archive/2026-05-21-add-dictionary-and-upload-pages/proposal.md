## Why

When learning new English vocabulary, the user repeatedly performs the same loop: look up a word on dictionary.cambridge.org, copy the definition and examples, then upload it to WordUp as a flashcard. Doing this through three separate tools (browser + cambridge-dictionary-api + wordup-helper CLI) is slow and breaks flow. A single local web app that combines lookup with a queue-to-upload workflow removes the manual copy/paste step and lets the user batch-upload words they actually want to keep.

## What Changes

- Add a local web application (single Node.js process serving HTML + JSON API) with two pages: a search page and an upload page.
- **Search page**: input box for a word; on submit, fetches the Cambridge Dictionary definition (English + Chinese translation) and renders pronunciation, part-of-speech, definitions, and example sentences.
- **Search history**: every successful lookup is persisted locally and shown on the upload page (deduplicated by word).
- **Upload page**: lists previously-looked-up words; supports single and multi-select; selected words can be deleted from the local list or uploaded to WordUp as flashcards.
- **WordUp integration**: uploads use the same REST endpoint and authentication scheme as `wordup-helper` (`access-token`, `client`, `uid` headers). Word definitions and examples captured from Cambridge are translated into the WordUp card payload.
- **Cambridge scraping**: reuses the scraping logic from `cambridge-dictionary-api` (cheerio + axios against `dictionary.cambridge.org`) inside this app, so no external API service needs to run.

## Capabilities

### New Capabilities
- `dictionary-lookup`: Fetching, parsing, and rendering Cambridge Dictionary entries for a given word and recording each successful lookup in a local history store.
- `word-queue-management`: Listing, selecting (single/multi), and deleting words from the locally-persisted lookup history.
- `wordup-upload`: Sending selected words from the local history to WordUp as flashcards via the WordUp REST API, with credential configuration and per-word success/failure reporting.

### Modified Capabilities
<!-- None — this is a greenfield project. -->

## Impact

- New code: a Node.js project at the repo root (`package.json`, server entry, route handlers, static frontend assets for two pages, local persistence file).
- New dependencies: `express`, `axios`, `cheerio`, `cors` (mirrors `cambridge-dictionary-api`'s stack).
- New configuration surface: WordUp credentials (`access-token`, `client`, `uid`) and a default `deck_id`, read from environment variables or a local config file that is git-ignored.
- External systems touched: `dictionary.cambridge.org` (read), `api.wordup.com.tw` (write). No data leaves the user's machine except for these two calls.
- Local persistence: a JSON file under the project (e.g. `data/history.json`) stores the lookup history; needs to be git-ignored.
