## ADDED Requirements

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
For each uploaded word, the system SHALL transform the locally-stored Cambridge entry into the WordUp `cards` payload format without making a fresh request to Cambridge.

#### Scenario: Payload field mapping
- **WHEN** the system uploads a word
- **THEN** the request body MUST contain:
  - `word` set to the Cambridge headword
  - `text_content.explanations[0].translations` set to the deduplicated non-empty Chinese translations from every Cambridge definition
  - `text_content.explanations[0].sentences` set to the flat list of example texts, with each example's `text` followed immediately by its `translation` when present (English/Chinese interleaved)
  - `text_content.explanations[0].notes`, `word_types`, `images`, `synonyms` set to empty arrays
  - `force_create` set to `true`
  - `deck_id` set to the configured deck id

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
