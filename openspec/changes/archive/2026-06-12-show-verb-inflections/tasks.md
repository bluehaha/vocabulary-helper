## 1. Client-side verb-forms logic

- [x] 1.1 In `public/search.js`, add a helper to read the first non-empty `entry.verbs` row of a given `type` (e.g. `findVerbForm(verbs, type)`), mirroring `server/wordup.js#findVerbForm`.
- [x] 1.2 In `public/search.js`, port `isRegularPast(base, past)` verbatim from `server/wordup.js`, with a comment pointing at the server as the source of truth.

## 2. Render the verb-forms line

- [x] 2.1 In `renderEntry`, compute `past` (first `"Past tense"` row) and `pastParticiple` (first `"Past participle"` row) from `entry.verbs`; treat the entry as a verb when at least one is present (do NOT gate on `entry.pos`).
- [x] 2.2 Determine irregularity: read the first `"Plain form"` row as `base`; irregular when `base` and `past` exist and `isRegularPast(base, past)` is false.
- [x] 2.3 Build a verb-forms line (e.g. `past · pastParticiple`, or just the single available form) and insert it into the header HTML directly after `entry__pos`, before `result__toolbar`. Apply a modifier class (e.g. `entry__verbforms--irregular`) when irregular. Render nothing when neither form is present.

## 3. Styling

- [x] 3.1 In `public/styles.css`, add styles for the verb-forms line and a bold variant for the irregular modifier class.

## 4. Verify

- [x] 4.1 Manually verify in the browser: an irregular verb (e.g. `spit`/`spat`, `eat`/`eaten`) shows bold past tense and past participle in the header; a regular verb (e.g. `walk`) shows them non-bold; a noun/adjective shows no verb-forms line; the rest of the result and the Chinese toggle/audio behavior are unchanged.
