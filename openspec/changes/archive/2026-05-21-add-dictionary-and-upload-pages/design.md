## Context

Two reference projects exist on this machine:

- `/Users/yushing/Package/cambridge-dictionary-api` — Node.js + Express + cheerio + axios. Scrapes `dictionary.cambridge.org/<nation>/dictionary/<language>/<word>`. Slug→language map: `en`→english/us, `uk`→english/uk, `en-tw`→english-chinese-traditional, `en-cn`→english-chinese-simplified. Has an in-memory cache (30 min TTL). Exposes `GET /api/dictionary/:language/:entry`. Response shape contains `word`, `pos[]`, `verbs[]`, `pronunciation[]`, `definition[]` with nested `example[]` (each with `text` and `translation`).
- `/Users/yushing/Project/toy/wordup-helper` — Python CLI. Uploads cards to `POST https://api.wordup.com.tw/api/v1/cards` with headers `access-token`, `client`, `uid`, and JSON body: `{ word, text_content: { explanations: [{ translations, sentences, word_types, notes, images, synonyms }] }, force_create, deck_id }`. The Python flow merges English + Chinese example sentences alternately into a flat `sentences` array.

The user wants a single local app — not a CLI plus a separate API server — that puts these two flows behind a two-page UI. No deployment, no auth, single-user, runs on `localhost`.

The repo is greenfield (only `openspec/` and `.claude/` directories exist). The tech stack is open, but the closer it stays to the reference projects' stack, the less mental overhead.

## Goals / Non-Goals

**Goals:**
- One `npm start` command brings up the whole app on `localhost`.
- Search → render Cambridge entry → automatically remembered for later upload, with no extra clicks.
- Upload page supports multi-select + bulk delete / bulk upload to WordUp.
- Per-word upload feedback (success / failure) so a partial batch is recoverable.
- Lookup history survives restarts (file-backed).
- WordUp credentials are kept out of git.

**Non-Goals:**
- Multi-user / auth / accounts.
- Deployment beyond localhost. No Docker, no Vercel.
- Editing Cambridge content before upload (the upload sends what was scraped, with the same English+Chinese-interleaved sentence shape `wordup-helper` uses).
- AI-generated definitions or examples (`wordup-helper` uses Gemini; this app intentionally does not — the source of truth is Cambridge).
- Pronunciation audio playback in v1 (we store the URLs but don't have to wire up a player).
- Search suggestions / autocomplete.
- Synchronizing history across machines.

## Decisions

### Decision: Node.js + Express, single process, server-rendered + vanilla JS frontend

Same stack as `cambridge-dictionary-api` (`express`, `axios`, `cheerio`, `cors`). The server both scrapes Cambridge and serves the two HTML pages plus a small JSON API consumed by inline `<script>` calls.

**Why over alternatives:**
- *vs. React/Vite SPA*: Two pages with minimal interactivity don't justify a build step. Vanilla `fetch` + DOM updates is faster to write and easier to debug for a localhost tool.
- *vs. Reusing `cambridge-dictionary-api` as a separate service*: User wants a single local page, not two processes. Inlining the scraping is one ~150-line module copy and removes a moving part.
- *vs. Python + Flask (to share code with `wordup-helper`)*: The Cambridge scraping is the more complex half and is already written in Node. The WordUp upload is ~15 lines of HTTP-with-headers and trivial to port.

### Decision: File-backed JSON history at `data/history.json`

One file, written synchronously on each lookup and each delete/upload. Shape: `{ words: [{ word, language, lookedUpAt, entry: { ...full Cambridge response... } }] }`. Deduplicated by `word` (case-insensitive) — repeat lookups update `lookedUpAt` and refresh `entry` but do not append.

**Why over alternatives:**
- *vs. SQLite*: Overkill for a list keyed by word with no querying beyond "list all" and "delete by word".
- *vs. localStorage*: Browser-local state is lost when the user clears storage or uses a different browser, and the upload step needs server-side access to the cached entry anyway (so the upload page doesn't have to re-scrape).
- *Storing the full entry, not just the word*: Re-scraping at upload time is slow and could fail / drift; the user already viewed and implicitly accepted the entry at lookup time.

### Decision: Pages and routes

- `GET /` → search page (`public/search.html`).
- `GET /upload` → upload page (`public/upload.html`).
- `GET /api/dictionary/:word` → scrape + cache + record to history; returns Cambridge JSON. Language is fixed to `en-tw` (English-Chinese Traditional) by default to match the upload flow's bilingual sentences; configurable later but not surfaced in v1 UI.
- `GET /api/history` → returns the history list (without full entries — just `word`, `lookedUpAt`, and a short preview) to keep the upload page snappy.
- `DELETE /api/history` → body `{ words: string[] }`; removes those words from history.
- `POST /api/upload` → body `{ words: string[] }`; for each word, transforms the stored Cambridge entry into the WordUp payload and POSTs to WordUp. Returns per-word `{ word, status: "success" | "failed", error? }`. On success, the word is also removed from history (matching `wordup-helper`'s `remove_word` behavior in `main.py:36`).

**Why `DELETE` with a body and not query params:** Multi-select can include many words; query strings get ugly fast. Express handles `DELETE` bodies fine when `express.json()` is enabled.

### Decision: WordUp payload mapping

Mirror `wordup-helper/api_client.py:post_word_card` exactly so behavior on WordUp's side is identical:

- `word` ← Cambridge `word` (the canonical headword from `.hw.dhw`).
- `translations` ← all `definition[].translation` values, deduplicated and non-empty.
- `sentences` ← flatten `definition[].example[]`: for each example push `text`, then `translation` if present. Same alternating pattern as `wordup-helper/main.py:27-31`.
- `notes` ← empty array in v1 (no AI step).
- `word_types`, `images`, `synonyms` ← empty arrays.
- `force_create: true`, `deck_id` ← from config.

### Decision: Configuration via `.env` + `dotenv`

Required keys: `WORDUP_ACCESS_TOKEN`, `WORDUP_CLIENT`, `WORDUP_UID`, `WORDUP_DECK_ID`. Optional: `PORT` (default 3000), `DICTIONARY_LANG` (default `en-tw`).

`.env`, `data/history.json`, and `node_modules/` go into `.gitignore` at project init. The app fails fast at startup with a clear message if any required WordUp env var is missing — but only when `/api/upload` is called, not at boot, so the user can still use the search page without WordUp set up.

### Decision: Cache scraping responses in-memory for the session

Same 30-min TTL Map cache as the reference project (`data.js:7-8`). History is the durable record; the cache is only a per-process speedup for re-lookups within a session.

## Risks / Trade-offs

- **Cambridge HTML changes** → scraper breaks. Mitigation: the reference selectors are already tested and reasonably specific (`.def-block.ddef_block`, `.hw.dhw`, etc.). Surface scraping failures as a clear "not found / parse failed" message rather than a 500. Re-syncing with upstream `cambridge-dictionary-api` if it gets fixes is a small diff.
- **WordUp credential leak** → uploads from an attacker on the same machine. Mitigation: localhost-only bind (`127.0.0.1`), `.env` git-ignored. The threat model is the same as `wordup-helper` already, which keeps creds in `config.py`.
- **History grows unbounded** → JSON file slow to read/write. Mitigation: the `GET /api/history` response strips the bulky `entry` field. Realistic usage is hundreds, not millions, of words; revisit if it becomes a problem.
- **Concurrent writes corrupting `history.json`** → unlikely with a single-user localhost app, but possible if two requests race. Mitigation: a simple in-memory mutex (queue of write tasks) around the read-modify-write cycle.
- **Partial batch upload** → some words succeed, some fail, and the user can't tell which. Mitigation: the `/api/upload` response is per-word; the UI shows ✓/✗ per row and only removes successful words from the history list.
- **No tests** → regressions go unnoticed. Mitigation: the surface is small (3 modules: scraper, history store, wordup client). One smoke test per module is enough for v1; full coverage is a non-goal.

## Migration Plan

Greenfield project — nothing to migrate. To bring it up:

1. `pnpm install` (or `npm install`).
2. Copy `.env.example` to `.env` and fill in WordUp credentials.
3. `pnpm start` → opens `http://localhost:3000`.

Rollback is `rm -rf` the project directory; no shared state outside the working tree.

## Open Questions

- **Display language**: hardcode `en-tw` for v1, or expose a dropdown? Default to hardcoded `en-tw` since the WordUp upload flow assumes bilingual content; revisit if the user wants English-only entries.
- **Delete confirmation**: bulk delete is destructive — do we confirm with a modal, or trust the user since the only loss is needing to re-look-up? Default to no confirmation for v1 (matches the lightweight feel); add later if it bites.
