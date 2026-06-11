# WordUp Upload

### Requirement: Upload selected words to WordUp
The system SHALL allow the user to upload one or more selected words from the local history to WordUp as flashcards via the WordUp REST API.

#### Scenario: Uploading a multi-word selection
- **WHEN** the user selects one or more words on the upload page and triggers the upload action
- **THEN** the system iterates over the selection and posts each word to `https://api.wordup.com.tw/api/v1/cards`
- **AND** the response is shown per-word, indicating success or failure
- **AND** each successfully-uploaded word is removed from the local history

#### Scenario: Upload action is disabled with no selection
- **WHEN** no rows are selected
- **THEN** the upload control is disabled or hidden, and triggering it has no effect

### Requirement: Construct the WordUp payload from the cached Cambridge entry
For each uploaded word, the system SHALL transform the locally-stored Cambridge entry into the WordUp `cards` payload format without making a fresh request to Cambridge, and SHALL include only English content in the payload.

#### Scenario: Payload field mapping
- **WHEN** the system uploads a word
- **THEN** the request body MUST contain:
  - `word` set to the entry's canonical word — the verb base form for verb entries, otherwise the Cambridge headword (see the `dictionary-lookup` capability's "Resolve verb lookups to their base-form entry")
  - `text_content.explanations[0].translations` set to the deduplicated non-empty translation lines derived from the Cambridge entry's definitions in their original order, where each line is built by prepending the abbreviated part of speech in parentheses followed by a space (e.g. `"(v) to move backwards ..."`) to the trimmed English definition text (`def.text`); definitions with an empty or missing `pos` contribute the bare text with no parenthetical prefix; when the entry qualifies under the irregular-verb rule (see "Prepend an inflection line for irregular verbs"), the inflection summary line is inserted as the first element of this array, before all definition-derived lines
  - `text_content.explanations[0].sentences` set to the flat list of English example texts in their original order, with empty strings dropped, and with NO Chinese example translations interleaved
  - `text_content.explanations[0].word_types` set to the deduplicated non-empty parts of speech (`def.pos`) from the same definitions that contributed translations, in their original order, using the full Cambridge label (e.g. `"verb"`, `"noun"`) — not the abbreviated form
  - `text_content.explanations[0].notes`, `images`, `synonyms` set to empty arrays
  - `force_create` set to `true`
  - `deck_id` set to the configured deck id

#### Scenario: Verb uploaded under its base form
- **WHEN** the system uploads an entry whose canonical word is the verb base form `spit` (originally searched as `spat`)
- **THEN** the request body's `word` is `spit`

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

### Requirement: Authenticate uploads with configured WordUp credentials
The system SHALL send WordUp uploads with the headers `access-token`, `client`, and `uid` populated from configuration, and SHALL refuse to upload when any required credential is missing.

#### Scenario: All credentials present
- **WHEN** the upload runs with all three WordUp credentials and a deck id configured
- **THEN** the request includes the three headers exactly as configured plus `content-type: application/json`

#### Scenario: A credential is missing
- **WHEN** any of `WORDUP_ACCESS_TOKEN`, `WORDUP_CLIENT`, `WORDUP_UID`, or `WORDUP_DECK_ID` is missing at upload time
- **THEN** the system returns an actionable configuration error to the upload page without contacting WordUp
- **AND** the history is unchanged

### Requirement: Per-word success and failure reporting
The system SHALL report the outcome of each word's upload independently so that a partial-batch failure leaves the user with an accurate, recoverable state.

#### Scenario: Mixed success and failure batch
- **WHEN** the user uploads N words and WordUp accepts some and rejects others
- **THEN** the response identifies each word's status as either `success` or `failed`
- **AND** failed words remain in the local history with their original entries intact
- **AND** successful words are removed from the local history
- **AND** the UI surfaces the per-word status to the user

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
