## Why

WordUp cards uploaded from this app currently arrive without a part of speech, so the user has to edit each card on WordUp to add it. The Cambridge entry already carries that information per-definition, so we can forward it automatically.

## What Changes

- Include the part of speech for each definition when building the WordUp payload:
  - Populate `text_content.explanations[0].word_types` from the cached Cambridge entry (card-level tags).
  - Prepend an abbreviated part-of-speech marker to each translation line (e.g. `"(v) to move backwards ..."`, `"(n) an act of shaking ..."`) so the part of speech is visible per definition.
- Continue to upload English content only; the part-of-speech tags are the only additions.
- No new HTTP endpoints; only the WordUp payload-building behavior changes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `wordup-upload`: the payload-construction requirement gains a rule that `word_types` is populated from the Cambridge entry's per-definition part of speech instead of always being empty.

## Impact

- `server/wordup.js` — `buildPayload` will read `def.pos` from the cached Cambridge entry, populate `word_types`, and prepend an abbreviated POS marker to each translation line. A small abbreviation map (`verb`→`v`, `noun`→`n`, …) is added; unknown POS values fall through verbatim.
- WordUp API: the request body's `text_content.explanations[].word_types` will be non-empty, and each entry in `translations` will start with `"(<abbrev>) "` when its source definition has a `pos`.
- No env or config changes; no UI changes.
