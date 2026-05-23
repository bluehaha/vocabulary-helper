## MODIFIED Requirements

### Requirement: Search a word via the search page
The system SHALL provide a search page at the root URL with a single text input and a submit action that triggers a lookup against `dictionary.cambridge.org` for the entered word. When the entry is rendered, the system SHALL hide all Chinese translations by default and expose a single user-controlled toggle that reveals or re-hides all Chinese translations for the currently displayed entry.

#### Scenario: Submitting a valid word
- **WHEN** the user enters a non-empty word and submits the form
- **THEN** the system fetches the Cambridge Dictionary entry for that word
- **AND** displays the canonical headword, parts of speech, pronunciation entries (with phonetic transcription and audio URL), and every definition with its example sentences
- **AND** Chinese translations (definition-level and example-level) are NOT visible in the rendered output
- **AND** records the lookup in the local history with the timestamp and the full scraped entry

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
