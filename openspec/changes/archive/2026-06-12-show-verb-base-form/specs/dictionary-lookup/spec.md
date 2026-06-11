## ADDED Requirements

### Requirement: Resolve verb lookups to their base-form entry
When a lookup's fetched entry carries a verb base form that differs (case-insensitively) from the word the user searched, the system SHALL perform a second Cambridge lookup for the base form and return that base-form entry — its definitions, examples, pronunciation, and headword — in place of the inflected-form entry. This ensures the displayed content is the base form's real entry, not Cambridge's inflected-form page (whose verb definition is typically just "past simple and past participle of ...").

The base form is the trimmed, non-empty `text` of the first `entry.verbs` row whose `type` is `"Plain form"` (by array order). The presence of such a row is itself the verb signal; the resolution MUST NOT be gated on the Cambridge `pos`, because Cambridge sometimes returns an empty `pos` for inflected-form pages (e.g. `ran`, `went`). The resolution happens once, server-side, at fetch time, so the search result, the history record, the upload-page word column, and the WordUp payload all observe the same resolved base-form entry. The recursive resolution terminates because a base form's own base form equals itself, so no second lookup is triggered for it.

#### Scenario: Verb searched by its past tense form
- **WHEN** the user looks up `spat`, whose fetched entry's `entry.verbs` includes `{ type: "Plain form", text: "spit" }`
- **THEN** the system performs a second lookup for `spit`
- **AND** the returned entry is the `spit` entry — its headword is `spit` and its definitions are the real `spit` definitions (e.g. "to force out the contents of the mouth ..."), not "past simple and past participle of ..."
- **AND** the history records the word as `spit`

#### Scenario: Verb searched by its past participle form
- **WHEN** the user looks up `eaten`, whose fetched entry's `entry.verbs` includes `{ type: "Plain form", text: "eat" }`
- **THEN** the returned entry is the `eat` entry with `eat`'s definitions and headword

#### Scenario: Inflected form whose Cambridge page has no part of speech
- **WHEN** the user looks up `ran`, whose fetched entry has an empty `pos` but whose `entry.verbs` includes `{ type: "Plain form", text: "run" }`
- **THEN** the system still performs a second lookup for `run` and returns the `run` entry
- **AND** the resolution is NOT skipped merely because `pos` is empty

#### Scenario: Verb already searched by its base form
- **WHEN** the user looks up `eat`, whose base form is `eat`
- **THEN** the base form equals the searched word, so NO second lookup is performed
- **AND** the `eat` entry is returned directly

#### Scenario: Word with no verb inflection data is not resolved
- **WHEN** the user looks up a word whose `entry.verbs` is empty OR has no `Plain form` row with non-empty text (e.g. a noun or adjective)
- **THEN** no second lookup is performed and the fetched entry is returned unchanged

#### Scenario: Base form equals the searched word
- **WHEN** the fetched entry has a `Plain form` row whose text matches the searched word (case-insensitively)
- **THEN** no second lookup is performed and the fetched entry is returned unchanged
- **AND** the lookup still succeeds

#### Scenario: Base-form lookup fails
- **WHEN** the base form differs from the searched word but the second Cambridge lookup returns `not_found` or an error
- **THEN** the system falls back to the originally-fetched inflected-form entry rather than failing the search

#### Scenario: Verb with multiple verb blocks
- **WHEN** `entry.verbs` contains more than one `Plain form` row
- **THEN** the FIRST `Plain form` row (by array order) with non-empty text is used as the base form
- **AND** later blocks' `Plain form` rows are ignored

## MODIFIED Requirements

### Requirement: Search a word via the search page
The system SHALL provide a search page at the root URL with a single text input and a submit action that triggers a lookup against `dictionary.cambridge.org` for the entered word. When the entry is rendered, the system SHALL hide all Chinese translations by default and expose a single user-controlled toggle that reveals or re-hides all Chinese translations for the currently displayed entry.

#### Scenario: Submitting a valid word
- **WHEN** the user enters a non-empty word and submits the form
- **THEN** the system fetches the Cambridge Dictionary entry for that word
- **AND** displays the canonical word (resolved to the verb base form per "Resolve verb lookups to their base-form entry"), parts of speech, pronunciation entries (with phonetic transcription and an in-page play control for the pronunciation audio), and every definition with its example sentences
- **AND** Chinese translations (definition-level and example-level) are NOT visible in the rendered output
- **AND** records the lookup in the local history with the timestamp and the full scraped entry, keyed by the canonical word

#### Scenario: Submitting an empty or whitespace-only input
- **WHEN** the user submits the form with an empty or whitespace-only input
- **THEN** the system does NOT perform a network request and does NOT modify the history
- **AND** keeps the user on the search page without an error toast (a no-op)

#### Scenario: Revealing Chinese translations for the current entry
- **WHEN** an entry is currently displayed with Chinese translations hidden
- **AND** the user activates the show-Chinese toggle
- **THEN** every Chinese translation in the displayed entry (definition-level and example-level) becomes visible
- **AND** the toggle's label/state reflects that Chinese is now shown

#### Scenario: Re-hiding Chinese translations for the current entry
- **WHEN** an entry is currently displayed with Chinese translations visible
- **AND** the user activates the toggle
- **THEN** every Chinese translation in the displayed entry becomes hidden again
- **AND** the toggle's label/state reflects that Chinese is now hidden

#### Scenario: New lookup resets translation visibility
- **WHEN** the user has revealed Chinese translations for one entry
- **AND** then submits a new word and a new entry is rendered
- **THEN** the new entry's Chinese translations are hidden by default

### Requirement: Persist lookup history across restarts
The system SHALL persist the lookup history to a local file so that the upload page reflects prior searches after the server is restarted.

#### Scenario: Restart preserves history
- **WHEN** the user looks up several words, stops the server, and starts it again
- **THEN** the previously looked-up words remain available on the upload page with their cached Cambridge entries

#### Scenario: Repeat lookup deduplicates by canonical word
- **WHEN** the user looks up a word whose canonical word already exists in the history (case-insensitive match on the canonical word)
- **THEN** the existing entry is updated in place (timestamp refreshed, entry replaced) rather than appended as a duplicate

#### Scenario: Inflected and base forms of the same verb deduplicate
- **WHEN** the user looks up `spat` (canonical word `spit`) and later looks up `spit`
- **THEN** both resolve to a single history row keyed by `spit`
- **AND** the row is updated in place on the second lookup rather than appended as a duplicate
