## 1. Project scaffold

- [x] 1.1 Initialize Node project (`package.json` with `start` script, dependencies: `express`, `axios`, `cheerio`, `cors`, `dotenv`; devDependency: `nodemon` optional)
- [x] 1.2 Add `.gitignore` excluding `node_modules/`, `.env`, `data/history.json`
- [x] 1.3 Add `.env.example` listing `WORDUP_ACCESS_TOKEN`, `WORDUP_CLIENT`, `WORDUP_UID`, `WORDUP_DECK_ID`, `PORT`, `DICTIONARY_LANG`
- [x] 1.4 Create directory layout: `server/` (express app + modules), `public/` (static HTML/CSS/JS), `data/` (history.json target, gitignored)

## 2. Cambridge scraper module

- [x] 2.1 Port the scraping logic from `/Users/yushing/Package/cambridge-dictionary-api/data.js` into `server/cambridge.js`, exposing `fetchEntry(word, lang)` that returns the same JSON shape (`word`, `pos`, `verbs`, `pronunciation`, `definition`)
- [x] 2.2 Implement the 30-min in-memory TTL cache around `fetchEntry`
- [x] 2.3 Map lookup outcomes to three results: `ok` (entry), `not_found` (404 from upstream or missing `.hw.dhw`), `error` (network/parse failure) — so the route can render distinct messages

## 3. History store module

- [x] 3.1 Create `server/history.js` with `load()`, `add(word, entry)`, `remove(words[])`, and `list({ withEntry: false })` operating on `data/history.json`
- [x] 3.2 Deduplicate by lowercased word in `add()`; update timestamp and replace the entry rather than appending
- [x] 3.3 Wrap all writes in a serial promise chain so concurrent requests cannot interleave a read-modify-write cycle
- [x] 3.4 Create the file on first write if it does not exist; tolerate a missing/empty file on `load()`

## 4. WordUp client module

- [x] 4.1 Create `server/wordup.js` exposing `uploadCard(entry)` that POSTs to `https://api.wordup.com.tw/api/v1/cards`
- [x] 4.2 Implement `buildPayload(entry)` that produces the exact `{ word, text_content, force_create, deck_id }` shape, with translations deduped and example sentences interleaved (English text then Chinese translation, mirroring `wordup-helper/main.py:27-31`)
- [x] 4.3 Read `WORDUP_ACCESS_TOKEN`, `WORDUP_CLIENT`, `WORDUP_UID`, `WORDUP_DECK_ID` from `process.env` lazily (at call time), and throw a typed `ConfigError` if any is missing
- [x] 4.4 Distinguish HTTP errors from network errors in the thrown error so the route returns a useful per-word message

## 5. Express server and routes

- [x] 5.1 Create `server/index.js`: load `dotenv`, instantiate Express, bind to `127.0.0.1`, serve `public/` statically, register the routes below
- [x] 5.2 `GET /` → serve `public/search.html`; `GET /upload` → serve `public/upload.html`
- [x] 5.3 `GET /api/dictionary/:word` → call scraper, persist to history on success, return the JSON entry; return appropriate 4xx/5xx with a JSON body distinguishing not-found vs. error
- [x] 5.4 `GET /api/history` → return the history list with `entry` stripped, sorted by `lookedUpAt` descending, with each row including a short `preview` (first translation or first definition text, truncated)
- [x] 5.5 `DELETE /api/history` (body `{ words: string[] }`) → remove those words from history, return the updated list
- [x] 5.6 `POST /api/upload` (body `{ words: string[] }`) → for each word, load its cached entry from history, transform via `buildPayload`, call `uploadCard`, collect per-word `{ word, status, error? }` results, remove successful words from history, return the result array

## 6. Search page (`public/search.html`)

- [x] 6.1 Static HTML with a search input, submit button, and a result region; link to `/upload`
- [x] 6.2 Inline (or separate) JS that calls `GET /api/dictionary/:word` on submit and renders headword, pronunciation entries, parts of speech, and each definition with its translation and example sentences
- [x] 6.3 Render distinct empty / not-found / error states (no result region, "word not found" message, "lookup failed" message)
- [x] 6.4 Minimal CSS so the page is readable on localhost (no need for a UI framework)

## 7. Upload page (`public/upload.html`)

- [x] 7.1 Static HTML with a table or list of history rows (checkbox + word + lookup time + preview), a "select all" control, and Delete / Upload buttons; link back to `/`
- [x] 7.2 On page load, fetch `GET /api/history` and render the rows; render an empty state when the list is empty
- [x] 7.3 Wire per-row checkboxes and "select all" to maintain a selection set; Delete and Upload buttons are disabled while the selection is empty
- [x] 7.4 Delete button → `DELETE /api/history` with the selected words, then re-render from the response
- [x] 7.5 Upload button → `POST /api/upload` with the selected words, then for each result mark the row ✓ or ✗ (with the error message on failure); after the response, re-fetch history so successful rows disappear

## 8. Smoke verification

- [x] 8.1 Start the server and confirm `/` loads the search page and `/upload` loads the upload page
- [x] 8.2 Look up a known Cambridge word (e.g. `cook`) end-to-end: results render, the word appears on `/upload` after navigating there
- [x] 8.3 Look up a non-existent word and confirm the "not found" state appears and the word is NOT added to history
- [x] 8.4 Look up the same word twice and confirm history has a single entry with an updated timestamp
- [x] 8.5 Delete one selected word from the upload page and confirm it is removed from `data/history.json`
- [x] 8.6 With WordUp credentials filled in, upload one word and confirm a card appears in the configured WordUp deck and the row disappears from the upload page; with credentials missing, confirm the configuration error surfaces on the upload page
