## 1. Base-form re-fetch in cambridge.js

- [x] 1.1 Add a helper in `server/cambridge.js` that returns the first non-empty trimmed `text` of a `verbs` row whose `type === "Plain form"`, or `undefined` (mirrors `findVerbForm(verbs, "Plain form")` selection order).
- [x] 1.2 In `fetchEntry`, after `verbs` is fetched, when a `Plain form` base exists and differs (case-insensitively) from the searched word, recursively call `fetchEntry(base, lang)` and return that base-form entry; on `not_found`/`error` fall back to the inflected entry. Do NOT gate on `parsed.pos` — Cambridge returns empty `pos` for some inflected pages (e.g. `ran`, `went`). Recursion terminates because a base form's own base form equals itself.
- [x] 1.3 Verify the re-fetched base-form entry is cached under the searched word's key (via `setCached(key, baseResult.entry)`) so a repeat lookup of the inflected form is a cache hit returning the base entry — confirm with a manual lookup of `spat`.

## 2. History keys off the canonical word

- [x] 2.1 In `server/index.js` `/api/dictionary/:word`, call `history.add` with `result.entry.word` (the normalized canonical word) instead of the raw query param, so dedup and the stored `word` key off the base form. (The raw query still drives the lookup.)
- [x] 2.2 Confirm `server/history.js` needs no change — `add`/`getEntry`/`list` already key case-insensitively off the passed word; they inherit the canonical value.

## 3. Downstream consumers inherit the canonical word

- [x] 3.1 Confirm `public/search.js` renders `entry.word` verbatim (no change) and shows the base form after a `spat`/`eaten` lookup.
- [x] 3.2 Confirm `public/upload.js` shows `row.word` (the canonical word) in the word column (no change).
- [x] 3.3 Confirm `server/wordup.js` `buildPayload` sets `word: entry.word` and therefore sends the base form for verbs (no code change; verify by inspecting the built payload for a `spat` entry).

## 4. Verification

- [x] 4.1 Manual: look up `spat` → search result and upload row both show `spit`; `eaten` → `eat`.
- [x] 4.2 Manual: look up a regular verb (e.g. `walk`) and a noun (e.g. `apple`) → word is unchanged from the searched/headword form.
- [x] 4.1b Manual: look up `spat` → the displayed definitions are the real `spit` definitions ("to force out the contents of the mouth ..."), NOT "past simple and past participle of ...".
- [x] 4.3 Manual: look up `spat`, then `spit` → a single history row keyed `spit`, updated in place (no duplicate).
- [x] 4.4 Manual: build the WordUp payload from a `spat`-sourced entry and confirm `word` is `spit` and the irregular-verb inflection line (`spat | spat`) still appears (payload verified; no live API upload performed).
- [x] 4.5 Run `openspec validate --change "show-verb-base-form"` and confirm it passes.
