# vocabulary-helper

Local Cambridge Dictionary lookup with a WordUp upload queue.

Look up words against the Cambridge Dictionary, keep an offline history of what
you searched, and batch-upload selected entries as cards to a WordUp deck.

## Features

- Scrapes Cambridge Dictionary pages for definitions, translations, examples,
  and audio (English / British English / English ↔ Traditional Chinese).
- In-memory cache (30 min TTL) to avoid re-fetching the same word.
- Persistent local history of every successful lookup (`data/history.json`).
- Upload queue page for picking words and pushing them to a WordUp deck.
- Successful uploads are removed from history automatically.

## Requirements

- Node.js 18+
- A WordUp account if you want the upload feature

## Setup

```sh
pnpm install   # or npm install
cp .env.example .env
```

Fill in `.env`:

| Variable               | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `WORDUP_ACCESS_TOKEN`  | WordUp API access token                                    |
| `WORDUP_CLIENT`        | WordUp API `client` header                                 |
| `WORDUP_UID`           | WordUp API `uid` header                                    |
| `WORDUP_DECK_ID`       | Initial target deck ID for uploaded cards                  |
| `WORDUP_DECK_NAME_PREFIX` | Prefix for auto-created decks when current deck exceeds 50 cards (e.g. `Vocabulary` → `Vocabulary 20260602`). Leave blank to disable rotation. |
| `PORT`                 | HTTP port (default `3000`)                                 |
| `DICTIONARY_LANG`      | Cambridge dictionary variant: `en`, `uk`, `en-tw` (default)|

The WordUp values can be left blank if you only use the lookup feature; the
server will only complain when you actually try to upload.

## Running

```sh
pnpm start      # node server/index.js
pnpm dev        # nodemon, restart on file changes
```

The server binds to `127.0.0.1:3000` (loopback only).

- Search UI:  http://127.0.0.1:3000/
- Upload UI:  http://127.0.0.1:3000/upload

## HTTP API

| Method | Path                     | Description                                              |
| ------ | ------------------------ | -------------------------------------------------------- |
| GET    | `/api/dictionary/:word`  | Look up a word; on success, append it to history.        |
| GET    | `/api/history`           | List previously looked-up words (no full entries).       |
| DELETE | `/api/history`           | Body: `{ "words": [...] }`. Remove entries from history. |
| POST   | `/api/upload`            | Body: `{ "words": [...] }`. Upload to WordUp, then drop successful ones from history. |

## Layout

```
server/      Express app, Cambridge scraper, history store, WordUp client
public/      Static search & upload pages
data/        history.json (created on first lookup)
openspec/    Change proposals and specs
```

## Notes

- Cambridge scraping relies on the live HTML; markup changes upstream may
  require updates to `server/cambridge.js`.
- History is plain JSON on disk — back it up or delete it freely.

## Deployment

Production deployment to an Oracle Cloud VM is automated via GitHub Actions
(`.github/workflows/deploy.yml`). See:

- Design: `docs/superpowers/specs/2026-05-29-oracle-vm-deploy-design.md`
- One-time VM setup: `deploy/README.md`
