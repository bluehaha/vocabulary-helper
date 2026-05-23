## 1. Payload construction

- [x] 1.1 In `server/wordup.js`, add a local `POS_ABBREV` map (`verb`→`v`, `noun`→`n`, `adjective`→`adj`, `adverb`→`adv`, `preposition`→`prep`, `pronoun`→`pron`, `conjunction`→`conj`, `determiner`→`det`, `exclamation`→`excl`) and a helper that, given a `pos` string, returns the abbreviation if mapped or the original `pos` string otherwise.
- [x] 1.2 In `buildPayload`, change `translations` so each entry is composed by prepending `"(<abbrev>) "` to the trimmed `def.text` when `def.pos` is non-empty, and just the trimmed `def.text` otherwise; dedup on the final composed string and preserve order.
- [x] 1.3 In `buildPayload`, set `text_content.explanations[0].word_types` to the deduplicated, order-preserving list of non-empty `def.pos` values (full Cambridge labels, not abbreviated), replacing the hard-coded `[]`.

## 2. Verification

- [x] 2.1 Manually invoke `buildPayload` with a fixture entry whose definitions have `pos` values `["verb", "verb", "noun"]` and distinct `def.text`; confirm `translations` is `["(v) ...", "(v) ...", "(n) ..."]` and `word_types` is `["verb", "noun"]`.
- [x] 2.2 Manually invoke `buildPayload` with a fixture entry whose definitions have empty/missing `pos`; confirm translations are bare text (no `(...)` prefix) and `word_types` is `[]`.
- [x] 2.3 Manually invoke `buildPayload` with a fixture entry that has a `pos` value not in the abbreviation map (e.g. `"modal verb"`); confirm the corresponding translation is prefixed with `"(modal verb) "`.
- [x] 2.4 Start the server, look up a word with a known part of speech (e.g. `shake`), and upload it; confirm in the request body that `word_types` is populated and each translation line starts with the expected `(v)` / `(n)` marker.
