## MODIFIED Requirements

### Requirement: Search a word via the search page
The system SHALL provide a search page at the root URL with a single text input and a submit action that triggers a lookup against `dictionary.cambridge.org` for the entered word.

#### Scenario: Submitting a valid word
- **WHEN** the user enters a non-empty word and submits the form
- **THEN** the system fetches the Cambridge Dictionary entry for that word
- **AND** displays the canonical headword, parts of speech, pronunciation entries (with phonetic transcription and an in-page play control for the pronunciation audio), and every definition with its Chinese translation and example sentences
- **AND** records the lookup in the local history with the timestamp and the full scraped entry

#### Scenario: Submitting an empty or whitespace-only input
- **WHEN** the user submits the form with an empty or whitespace-only input
- **THEN** the system does NOT perform a network request and does NOT modify the history
- **AND** keeps the user on the search page without an error toast (a no-op)

## ADDED Requirements

### Requirement: Play pronunciation audio in place
The system SHALL play pronunciation audio inside the current search page in response to a user click on a pronunciation control, without navigating to the audio URL or opening a new browser tab.

#### Scenario: Clicking the play control plays the audio in place
- **WHEN** the user clicks the play control next to a pronunciation entry on the result
- **THEN** the system plays that pronunciation's audio in the current page
- **AND** does NOT open a new tab, navigate away, or change the page URL

#### Scenario: Only one pronunciation plays at a time
- **WHEN** a pronunciation is already playing and the user clicks the play control on a different pronunciation entry on the same result
- **THEN** the system stops the currently playing pronunciation before starting the new one
- **AND** the previously playing control returns to its idle visual state

#### Scenario: Playback failure does not break the page
- **WHEN** the browser cannot play the pronunciation audio (e.g., autoplay policy blocks it, the network request fails, or the audio resource errors)
- **THEN** the system surfaces a visible error message to the user
- **AND** the play control returns to its idle visual state so the user can retry
- **AND** the rest of the search result (definitions, examples, other pronunciations) remains intact and interactive
