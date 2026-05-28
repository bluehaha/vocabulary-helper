## Why

When a Cambridge entry is a verb with irregular inflection (e.g. `sing → sang → sung`, `sting → stung → stung`), the WordUp card we upload only shows the headword. The user then has to remember or look up the past tense and past participle separately. The scraped entry already carries the inflected forms (`entry.verbs`) — for irregular verbs we can surface them on the card automatically.

## What Changes

- When the cached Cambridge entry has `verb` among its parts of speech AND the Past tense form is NOT what a regular `-ed/-d/-ied` rule would produce from the Plain form, the WordUp payload SHALL prepend an inflection line as the first entry of `text_content.explanations[0].translations` (before all `(v)`, `(n)`, ... definition lines).
- The inflection line has the shape `"<past tense> | <past participle>"` (forms verbatim from `entry.verbs`, separated by ` | `, no labels or POS prefix). Both forms are always listed even when they are identical (e.g. `"stung | stung"`).
- Regular verbs (Past tense matches `Plain form + ed/d/ied` including doubled-consonant `-ed`) get NO inflection line — payload is unchanged from today.
- Non-verbs (no `verb` in `entry.pos`) get NO inflection line.
- When `entry.verbs` is missing/empty, or lacks a Past tense / Past participle entry, NO inflection line is added (silent skip — the upload still succeeds).
- No new HTTP endpoints, no UI changes, no env/config changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `wordup-upload`: the payload-construction requirement gains a rule that, for irregular verbs, an inflection line is prepended to `translations`. The `word_types`, `sentences`, and other fields are unaffected.

## Impact

- `server/wordup.js` — `buildPayload` will read `entry.verbs` and `entry.pos`, decide whether the verb is irregular, and (if so) prepend one composed inflection line to `translations`. A small helper for the regularity check is added.
- WordUp API: for irregular verbs the request body's `text_content.explanations[0].translations` gains one extra leading element; for regular verbs and non-verbs the body is byte-for-byte identical to today.
- No changes to `server/cambridge.js` (the `verbs` array is already populated), no changes to history storage, no UI changes.
