## Why

Searching the adjective `rugged` wrongly shows the entry for `rug`. The current base-form resolver (added by `show-verb-base-form`) decides to jump to the base form whenever the scraped **Simple Wiktionary** inflection table has a `Plain form` row that differs from the searched word. But Wiktionary lists `rugged` as the past participle of the verb `rug`, so `rugged` resolves to `rug` even though Cambridge correctly classifies `rugged` as a standalone adjective with its own real definitions. The same false jump affects `learned`, `aged`, `blessed`, `dogged`, and any word that is both a real word and coincidentally a verb inflection.

The fix is to stop using Wiktionary to decide the jump and instead trust Cambridge's own page: Cambridge marks genuine inflected-form pages with a usage label like "past simple of" / "past participle of" / "past simple and past participle of" and links to the base word, while real words (adjectives, nouns) carry their own definitions and no such label.

## What Changes

- The system SHALL decide whether to resolve a lookup to its base form using **Cambridge's own inflected-form marker**, not the Simple Wiktionary `Plain form` row.
- A fetched Cambridge entry is treated as an inflected form ONLY when it has a definition whose usage label matches "past simple of", "past tense of", "past participle of", or "past simple and past participle of" (case-insensitive), pointing at a linked base word. The base word is read from that definition's cross-reference link.
- When such a marker is present and the linked base word differs (case-insensitively) from the searched word, the system performs a second Cambridge lookup for the base word and returns that entry (current behavior, new trigger).
- When no such marker is present, the fetched entry is returned unchanged — so `rugged`, `learned`, `aged`, etc. now stay on their own adjective/noun entries.
- The Simple Wiktionary scrape (`entry.verbs`) is STILL fetched and still populates the search-page past tense / past participle display and the WordUp irregular-verb line. Only the **base-form jump decision** stops depending on it. **BREAKING** to the internal resolution trigger only; no API shape change.
- Fallbacks unchanged: if the base-form lookup fails, fall back to the originally-fetched entry. History dedup still keys off the resolved word.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `dictionary-lookup`: the "Resolve verb lookups to their base-form entry" requirement changes its trigger from "the first Wiktionary `Plain form` row differs from the searched word" to "the Cambridge entry carries an inflected-form usage label ('past … of') linking to a base word that differs from the searched word." The re-fetch, fallback, and history-dedup behavior are otherwise preserved.

## Impact

- `server/cambridge.js` — the parser captures the inflected-form usage label and its base-word cross-reference from the Cambridge page; `fetchEntry` uses that (instead of `basePlainForm(verbs)`) to decide and perform the base-form re-fetch. `basePlainForm` is no longer used for the jump decision (the helper may remain if still referenced, otherwise removed). The `entry.verbs` fetch is unchanged.
- No changes to `server/wordup.js`, `public/search.js`, history storage, or the upload page. The past tense / past participle display and the WordUp irregular line continue to read `entry.verbs`.
- Behavior changes: `rugged → rugged` (was `rug`), `learned/aged/blessed/dogged` stay put; `spat → spit`, `eaten → eat`, `ran → run`, `swum → swim` continue to resolve via Cambridge's "past … of" label.
- No new endpoints, no env/config changes, no new dependencies.
