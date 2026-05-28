## 1. Detection helpers

- [x] 1.1 In `server/wordup.js`, add a helper `findVerbForm(verbs, type)` that returns the `text` of the first entry in `verbs` whose `type` equals the given label (`"Plain form"`, `"Past tense"`, `"Past participle"`), or `undefined` if no such entry exists.
- [x] 1.2 In `server/wordup.js`, add a helper `isRegularPast(base, past)` that returns `true` iff `past.toLowerCase()` matches any of: `base + "ed"` (e.g. `walk`/`walked`), `base + "d"` when `base` ends in `e` (e.g. `like`/`liked`), `base.slice(0,-1) + "ied"` when `base` ends in a consonant followed by `y` (e.g. `try`/`tried`), or `base + base.slice(-1) + "ed"` when `base` is ≤ 5 characters AND ends in a single vowel followed by a single consonant other than `w`, `x`, `y` (doubled-consonant short verbs like `stop`/`stopped`).

## 2. Payload construction

- [x] 2.1 In `server/wordup.js#buildPayload`, after computing `translations` from the definitions, decide whether to prepend an inflection line: only when `(entry.pos || []).includes("verb")`, AND `findVerbForm(entry.verbs, "Plain form")` and `findVerbForm(entry.verbs, "Past tense")` are both non-empty strings, AND `isRegularPast(base, past)` returns `false`.
- [x] 2.2 When the irregular-verb condition is met, compose `inflectionLine = "<past> | <pp>"` where `<pp>` is `findVerbForm(entry.verbs, "Past participle")` if present and non-empty, otherwise `<past>` as fallback; `unshift` `inflectionLine` onto `translations` so it becomes element 0 (the literal ` | ` separator cannot collide with any `"(<pos>) ..."` definition line, so it sits in front of the deduplicated array safely).
- [x] 2.3 Leave `sentences`, `word_types`, `notes`, `images`, `synonyms`, `force_create`, `deck_id`, and `word` exactly as today — only `translations` gains the leading inflection line, and only when the conditions in 2.1 are met.

## 3. Verification

- [x] 3.1 Manually invoke `buildPayload` with a fixture entry where `entry.pos = ["verb", "noun"]` and `entry.verbs` contains the `sting` fixture from `data/history.json` (irregular); confirm `translations[0]` equals `"<first Past tense> | <first Past participle>"` (e.g. `"stang | stung"` from the real Wiktionary first block) and the remaining lines are the original definition lines in order.
- [x] 3.2 Manually invoke `buildPayload` with a fixture entry for `sing` (irregular: `sing`/`sang`/`sung`); confirm `translations[0]` equals `"sang | sung"`.
- [x] 3.3 Manually invoke `buildPayload` with a fixture verb entry for `walk` (regular `-ed`), `try` (regular `-ied`), `like` (regular `-d`), and `stop` (regular doubled `-ed`); confirm NO inflection line is prepended in any case and `translations` matches the pre-change output.
- [x] 3.4 Manually invoke `buildPayload` with a fixture entry where `entry.pos = ["noun"]` only but `entry.verbs` happens to contain a `Past tense` row (e.g. a noun-only Wiktionary entry); confirm NO inflection line is prepended.
- [x] 3.5 Manually invoke `buildPayload` with a fixture verb entry whose `entry.verbs` is `[]` or missing `Past tense`; confirm NO inflection line is prepended and the payload is otherwise unchanged.
- [x] 3.6 Manually invoke `buildPayload` with a fixture irregular verb entry that has a `Past tense` row but no `Past participle` row; confirm `translations[0]` equals `"<past> | <past>"` (the past tense is reused).
- [x] 3.7 Start the server, look up an irregular verb (e.g. `sing` or `sting`) end-to-end, upload it, and inspect the WordUp request body (or response) to confirm the inflection line is the first translation.
- [x] 3.8 Start the server, look up a regular verb (e.g. `walk`) end-to-end, upload it, and confirm the request body's `translations` is unchanged from before this change.
