## Why

When a verb is searched by an inflected form, the displayed entry is wrong in two ways: the headword is inconsistent (Cambridge returns `eat` for `eaten` but keeps `spat` for `spat`), AND the inflected-form page's content is useless — Cambridge's verb definition for `spat` is literally "past simple and past participle of [spit]" with none of the real definitions. The user always wants the base form's actual entry. The scraped response already carries the base form in `entry.verbs` ("Plain form"), so we can detect it and look up the real entry.

## What Changes

- When a fetched entry is a verb and its base form differs from the searched word, the system SHALL perform a **second Cambridge lookup for the base form** and return that base-form entry (its real definitions, examples, pronunciation, and headword) instead of the inflected-form page.
- The base form is derived from `entry.verbs`: the first row whose `type` is `"Plain form"` with non-empty text. When the entry is not a verb, no usable `Plain form` exists, or the base form equals the searched word, the originally-fetched entry is returned unchanged (no change for nouns, adjectives, regular cases, or base-form searches).
- If the base-form lookup fails (not found / error), the system falls back to the originally-fetched inflected-form entry rather than failing the search.
- History is keyed/deduplicated by the resolved base-form word, so searching `spat` and later `spit` resolve to a single row rather than two.
- The resolution happens once, server-side, when the entry is fetched, so every downstream consumer (search render, history list, upload payload) sees the same base-form entry. Recursion terminates because a base form's own base form equals itself.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `dictionary-lookup`: the lookup requirement gains a rule that, for verb entries searched by an inflected form, the system re-fetches and returns the base form's entry (derived from `entry.verbs` "Plain form"); history dedup keys off this resolved base word.
- `wordup-upload`: the payload-construction requirement changes `word` from "the Cambridge headword" to the resolved base-form word (which equals the headword for non-verbs and for base-form searches).

## Impact

- `server/cambridge.js` — `fetchEntry` detects the base form for verb entries and, when it differs from the searched word, recursively re-fetches the base form and returns that entry (caching it under the searched word's key too); a small helper reads the first `Plain form` from `verbs`. Recursion terminates naturally and falls back to the inflected entry on failure.
- `server/history.js` — no logic change required if the entry's `word` is already normalized upstream; dedup already keys off `word` (case-insensitive), so it inherits the canonical word.
- `server/wordup.js` — `buildPayload` already sets `word: entry.word`; it inherits the normalized value with no code change beyond confirming behavior.
- `public/search.js` / `public/upload.js` — render `entry.word` / `row.word` as received; they inherit the normalized value with no change.
- WordUp API: for verbs searched by an inflected form, the card's `word` becomes the base form; for everything else the payload is unchanged.
- No new endpoints, no env/config changes, no UI layout changes.
