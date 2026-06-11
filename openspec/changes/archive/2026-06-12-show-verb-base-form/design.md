## Context

A Cambridge lookup returns an `entry` whose `word` is Cambridge's headword. For verbs searched by an inflected form this is inconsistent: `eaten` resolves to `eat` (base), but `spat` stays `spat` (past tense). The user always wants the base form.

The scraped `entry.verbs` array already carries the base form as the row `{ type: "Plain form", text: "<base>" }` (e.g. `spit`, `eat`). This is the same data the irregular-verb inflection line already relies on (`server/wordup.js` → `findVerbForm(verbs, "Plain form")`). So the base form is available in the response without any extra network request.

`entry.word` flows to three consumers, all of which currently take it verbatim:
- search render (`public/search.js` → `entry.word`)
- history record (`server/history.js` → keyed case-insensitively on `word`), surfaced on the upload page
- WordUp payload (`server/wordup.js` → `word: entry.word`)

## Goals / Non-Goals

**Goals:**
- A single canonical word — the base form for verbs — is shown consistently on the search page, the upload page, in the stored history, and in the WordUp card.
- Normalization happens once, server-side, at fetch time, so all downstream consumers inherit it without their own logic.
- History dedup keys off the canonical word, so `spat` and `spit` collapse to one row.

**Non-Goals:**
- No change to how `entry.verbs`, definitions, examples, pronunciation, or the irregular-verb inflection line are built.
- No normalization for non-verbs (nouns, adjectives, etc.) — their headword is already what the user searched/wants.
- No client-side normalization; the pages keep rendering `word` as received.
- No re-fetch or re-scrape of existing cached/stored entries (see Migration).

## Decisions

### Re-fetch the base form at the source: `fetchEntry` in `server/cambridge.js`
Relabeling the headword is not enough: Cambridge's inflected-form page (`spat`) has no real definitions — its top verb sense is just "past simple and past participle of [spit]". To show real content we must fetch the base form's own Cambridge entry. So when a verb's base form differs from the searched word, `fetchEntry` recursively calls itself for the base form and returns that result.

- **Why here**: `fetchEntry` is the single chokepoint where both `pos` and the fully-populated `verbs` array exist. Re-fetching here means `history.add`, `history.list`, the search render, and `buildPayload` all inherit the base-form entry for free.
- **Termination**: the base form's own base form equals itself (looking up `spit` yields base form `spit`), so the case-insensitive `base !== searched` guard prevents infinite recursion — at most one extra lookup.
- **Caching**: the base-form entry is cached under both the searched word's URL key and (via the inner call) its own key, so a repeat `spat` search is a cache hit returning the `spit` entry.
- **Failure fallback**: if the base-form lookup returns `not_found`/`error`, we return the originally-fetched inflected entry rather than failing the whole search.
- **Alternative considered — relabel `entry.word` only**: rejected; the displayed definitions/examples would still be the inflected page's near-empty content, which is the core complaint.
- **Alternative considered — resolve in each consumer**: rejected; it would duplicate the rule and require each consumer to make its own network call.

### Base-form rule
Take the first `verbs` row with `type === "Plain form"` and non-empty trimmed `text`. Re-fetch only if it differs (case-insensitively) from the searched word. **Do not gate on `entry.pos`**: Cambridge returns an empty `pos` for some inflected-form pages (e.g. `ran`, `went`), so gating on `pos.includes("verb")` would skip exactly the words that most need resolving. The Wiktionary-sourced `Plain form` row is itself a reliable verb signal (it only exists for verbs), so its presence alone triggers the re-fetch. Reuses the same selection logic as the existing inflection line ("first Plain form by array order"), keeping the two features consistent for multi-block verbs. Words with no usable `Plain form` are untouched — byte-for-byte identical to today.

### History keying inherits the canonical word
`history.add(word, entry)` is currently called with the raw searched word from the request path (`server/index.js`). To dedup by base form, the history key must come from the normalized `entry.word`, not the raw query param. The add path stores/keys on `entry.word` (the canonical base form) so `spat` then `spit` resolve to one row. The raw query is still used only to perform the lookup.

## Risks / Trade-offs

- **A verb whose Wiktionary page is missing or has no "Plain form" row** → falls back to the Cambridge headword (today's behavior); no regression, just no normalization for that word.
- **Wiktionary returns an unexpected base form** (wrong sense, archaic) → the displayed/uploaded word would be that form. Mitigation: only triggered when a `Plain form` row exists (verb-specific inflection data), and `fetchVerbs` already tolerates/empties on failure; the blast radius is the single word.
- **Existing history rows scraped before this change** keep their old (inflected) word until re-looked-up. Mitigation: acceptable — re-searching the word normalizes it; no migration script needed.
- **Searching the inflected form after the base form is already stored** now updates the existing base-form row instead of creating a second row — this is the intended dedup, but it does change the previously-observed "two rows" behavior. Called out as the explicit win, not a regression.

## Migration Plan

- No data migration. Cached in-memory entries and persisted `data/history.json` rows created before this change retain their original `word`; they normalize naturally on the next lookup.
- Rollback: revert `server/cambridge.js` (and the `history.add` keying change in `server/index.js`); no schema or stored-format change to undo.
