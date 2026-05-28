## ADDED Requirements

### Requirement: Prepend an inflection line for irregular verbs
For each uploaded word whose cached Cambridge entry includes `verb` among its parts of speech AND whose verb conjugation cannot be derived from the plain form by appending `-ed`, `-d`, or `-ied` (including the doubled-consonant `-ed` form for short single-syllable verbs), the system SHALL prepend one inflection summary line as the first element of `text_content.explanations[0].translations`, before any definition-derived translation lines.

The inflection line MUST have the shape `"<past tense form> | <past participle form>"` — both forms verbatim from `entry.verbs`, separated by ` | ` (space-pipe-space), with no POS prefix or labels. Both forms are listed even when identical (e.g. `"stung | stung"`).

#### Scenario: Irregular verb with distinct past and past participle
- **WHEN** the cached entry has `pos` containing `"verb"`, and `entry.verbs` includes `{ type: "Plain form", text: "sing" }`, `{ type: "Past tense", text: "sang" }`, `{ type: "Past participle", text: "sung" }`
- **THEN** `text_content.explanations[0].translations[0]` equals `"sang | sung"`
- **AND** all original definition-derived translation lines follow it in their original order

#### Scenario: Irregular verb with identical past and past participle
- **WHEN** the cached entry has `pos` containing `"verb"`, and `entry.verbs` includes `{ type: "Plain form", text: "sting" }`, `{ type: "Past tense", text: "stung" }`, `{ type: "Past participle", text: "stung" }`
- **THEN** `text_content.explanations[0].translations[0]` equals `"stung | stung"`
- **AND** the form `stung` appears on both sides of the `|` even though they are identical

#### Scenario: Regular `-ed` verb gets no inflection line
- **WHEN** the cached entry has `pos` containing `"verb"`, and `entry.verbs` includes `{ type: "Plain form", text: "walk" }`, `{ type: "Past tense", text: "walked" }`, `{ type: "Past participle", text: "walked" }`
- **THEN** NO inflection line is prepended to `translations`
- **AND** the payload is byte-for-byte identical to the pre-change behavior for this entry

#### Scenario: Regular `-ied` verb gets no inflection line
- **WHEN** the cached entry has `pos` containing `"verb"`, and `entry.verbs` includes `{ type: "Plain form", text: "try" }`, `{ type: "Past tense", text: "tried" }`, `{ type: "Past participle", text: "tried" }`
- **THEN** NO inflection line is prepended to `translations`

#### Scenario: Regular `-d` verb (base ending in `e`) gets no inflection line
- **WHEN** the cached entry has `pos` containing `"verb"`, and `entry.verbs` includes `{ type: "Plain form", text: "like" }`, `{ type: "Past tense", text: "liked" }`, `{ type: "Past participle", text: "liked" }`
- **THEN** NO inflection line is prepended to `translations`

#### Scenario: Regular doubled-consonant `-ed` verb gets no inflection line
- **WHEN** the cached entry has `pos` containing `"verb"`, and `entry.verbs` includes `{ type: "Plain form", text: "stop" }`, `{ type: "Past tense", text: "stopped" }`, `{ type: "Past participle", text: "stopped" }`
- **THEN** NO inflection line is prepended to `translations`

#### Scenario: Non-verb entry gets no inflection line
- **WHEN** the cached entry has `pos` equal to `["noun"]` only (e.g. `apple`)
- **THEN** NO inflection line is prepended to `translations` regardless of what `entry.verbs` contains

#### Scenario: Verb entry with missing inflection data
- **WHEN** the cached entry has `pos` containing `"verb"` but `entry.verbs` is empty OR does not contain a `Past tense` row OR does not contain a `Plain form` row
- **THEN** NO inflection line is prepended to `translations`
- **AND** the upload still succeeds with the unmodified payload

#### Scenario: Verb entry with Past tense but missing Past participle
- **WHEN** the cached entry has `pos` containing `"verb"`, and `entry.verbs` contains `{ type: "Plain form", text: "<base>" }` and `{ type: "Past tense", text: "<past>" }` but no `Past participle` row, AND the verb is irregular
- **THEN** `text_content.explanations[0].translations[0]` equals `"<past> | <past>"` (the past tense is used as a fallback for the past participle slot)

#### Scenario: Verb entry with multiple verb blocks
- **WHEN** `entry.verbs` contains multiple `Plain form` and `Past tense` rows from more than one verb block
- **THEN** the FIRST `Plain form` and the FIRST `Past tense` (by array order) are used for the regularity check and the inflection line
- **AND** later blocks' rows are ignored

#### Scenario: Mixed-POS word that is also a verb
- **WHEN** the cached entry has `pos` containing both `"verb"` and `"noun"` (e.g. `sting`) and the verb conjugation is irregular
- **THEN** the inflection line is prepended exactly once before all definition lines (verb and noun definitions alike)
- **AND** `word_types` continues to include both `"verb"` and `"noun"`

## MODIFIED Requirements

### Requirement: Construct the WordUp payload from the cached Cambridge entry
For each uploaded word, the system SHALL transform the locally-stored Cambridge entry into the WordUp `cards` payload format without making a fresh request to Cambridge, and SHALL include only English content in the payload.

#### Scenario: Payload field mapping
- **WHEN** the system uploads a word
- **THEN** the request body MUST contain:
  - `word` set to the Cambridge headword
  - `text_content.explanations[0].translations` set to the deduplicated non-empty translation lines derived from the Cambridge entry's definitions in their original order, where each line is built by prepending the abbreviated part of speech in parentheses followed by a space (e.g. `"(v) to move backwards ..."`) to the trimmed English definition text (`def.text`); definitions with an empty or missing `pos` contribute the bare text with no parenthetical prefix; when the entry qualifies under the irregular-verb rule (see "Prepend an inflection line for irregular verbs"), the inflection summary line is inserted as the first element of this array, before all definition-derived lines
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
