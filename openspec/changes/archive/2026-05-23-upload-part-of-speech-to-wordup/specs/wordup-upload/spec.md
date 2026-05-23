## MODIFIED Requirements

### Requirement: Construct the WordUp payload from the cached Cambridge entry
For each uploaded word, the system SHALL transform the locally-stored Cambridge entry into the WordUp `cards` payload format without making a fresh request to Cambridge, and SHALL include only English content in the payload.

#### Scenario: Payload field mapping
- **WHEN** the system uploads a word
- **THEN** the request body MUST contain:
  - `word` set to the Cambridge headword
  - `text_content.explanations[0].translations` set to the deduplicated non-empty translation lines derived from the Cambridge entry's definitions in their original order, where each line is built by prepending the abbreviated part of speech in parentheses followed by a space (e.g. `"(v) to move backwards ..."`) to the trimmed English definition text (`def.text`); definitions with an empty or missing `pos` contribute the bare text with no parenthetical prefix
  - `text_content.explanations[0].sentences` set to the flat list of English example texts in their original order, with empty strings dropped, and with NO Chinese example translations interleaved
  - `text_content.explanations[0].word_types` set to the deduplicated non-empty parts of speech (`def.pos`) from the same definitions that contributed translations, in their original order, using the full Cambridge label (e.g. `"verb"`, `"noun"`) — not the abbreviated form
  - `text_content.explanations[0].notes`, `images`, `synonyms` set to empty arrays
  - `force_create` set to `true`
  - `deck_id` set to the configured deck id

#### Scenario: Part-of-speech abbreviation mapping
- **WHEN** a definition has a `pos` value listed in the known abbreviation map
- **THEN** the corresponding translation line is prefixed with the abbreviation in parentheses according to this mapping:
  - `verb` → `(v)`
  - `noun` → `(n)`
  - `adjective` → `(adj)`
  - `adverb` → `(adv)`
  - `preposition` → `(prep)`
  - `pronoun` → `(pron)`
  - `conjunction` → `(conj)`
  - `determiner` → `(det)`
  - `exclamation` → `(excl)`
- **AND** any `pos` value not in this map is passed through verbatim inside the parentheses (e.g. a `pos` of `"modal verb"` produces a prefix of `"(modal verb) "`)

#### Scenario: Chinese content is not forwarded
- **WHEN** the cached Cambridge entry contains Chinese definition translations and Chinese example translations
- **THEN** none of that Chinese content appears anywhere in the request body sent to WordUp
- **AND** the cached entry in local history is unchanged

#### Scenario: Multiple parts of speech are deduplicated and preserved in order
- **WHEN** the cached entry has definitions whose `pos` values are, in order, `"verb"`, `"verb"`, `"noun"`
- **THEN** `text_content.explanations[0].word_types` equals `["verb", "noun"]`
- **AND** the corresponding translation lines are individually prefixed (`"(v) ..."`, `"(v) ..."`, `"(n) ..."`) — except that lines whose final composed string is identical are deduplicated

#### Scenario: Cached entry has no part of speech
- **WHEN** every definition in the cached entry has an empty or missing `pos`
- **THEN** `text_content.explanations[0].word_types` is an empty array
- **AND** each translation line is the bare trimmed `def.text` with no parenthetical prefix
- **AND** the rest of the payload is unchanged from the pre-change behavior
