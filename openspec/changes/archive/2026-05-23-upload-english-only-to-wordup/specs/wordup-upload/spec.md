## MODIFIED Requirements

### Requirement: Construct the WordUp payload from the cached Cambridge entry
For each uploaded word, the system SHALL transform the locally-stored Cambridge entry into the WordUp `cards` payload format without making a fresh request to Cambridge, and SHALL include only English content in the payload.

#### Scenario: Payload field mapping
- **WHEN** the system uploads a word
- **THEN** the request body MUST contain:
  - `word` set to the Cambridge headword
  - `text_content.explanations[0].translations` set to the deduplicated non-empty English definition texts (`def.text`) from the Cambridge entry, in their original order
  - `text_content.explanations[0].sentences` set to the flat list of English example texts in their original order, with empty strings dropped, and with NO Chinese example translations interleaved
  - `text_content.explanations[0].notes`, `word_types`, `images`, `synonyms` set to empty arrays
  - `force_create` set to `true`
  - `deck_id` set to the configured deck id

#### Scenario: Chinese content is not forwarded
- **WHEN** the cached Cambridge entry contains Chinese definition translations and Chinese example translations
- **THEN** none of that Chinese content appears anywhere in the request body sent to WordUp
- **AND** the cached entry in local history is unchanged
