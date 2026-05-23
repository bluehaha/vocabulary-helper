## ADDED Requirements

### Requirement: Search a word via the search page
The system SHALL provide a search page at the root URL with a single text input and a submit action that triggers a lookup against `dictionary.cambridge.org` for the entered word.

#### Scenario: Submitting a valid word
- **WHEN** the user enters a non-empty word and submits the form
- **THEN** the system fetches the Cambridge Dictionary entry for that word
- **AND** displays the canonical headword, parts of speech, pronunciation entries (with phonetic transcription and audio URL), and every definition with its Chinese translation and example sentences
- **AND** records the lookup in the local history with the timestamp and the full scraped entry

#### Scenario: Submitting an empty or whitespace-only input
- **WHEN** the user submits the form with an empty or whitespace-only input
- **THEN** the system does NOT perform a network request and does NOT modify the history
- **AND** keeps the user on the search page without an error toast (a no-op)

### Requirement: Handle words that Cambridge does not have
The system SHALL distinguish between "word not found at Cambridge" and "unexpected error" when a lookup fails, and SHALL NOT record failed lookups in the history.

#### Scenario: Word does not exist on Cambridge
- **WHEN** Cambridge returns a non-200 response or returns a page with no headword
- **THEN** the system shows a clear "word not found" message on the search page
- **AND** does NOT add the word to the local history

#### Scenario: Network or parse failure
- **WHEN** the upstream request times out, the network is unreachable, or HTML parsing throws
- **THEN** the system shows an error message that distinguishes this from "not found"
- **AND** does NOT add the word to the local history

### Requirement: Cache repeated lookups within a session
The system SHALL serve repeat lookups for the same word from an in-memory cache with a 30-minute TTL to avoid redundant requests to Cambridge.

#### Scenario: Looking up the same word twice
- **WHEN** the user searches the same word twice within 30 minutes
- **THEN** the second response is served from cache without hitting `dictionary.cambridge.org`
- **AND** the history entry's timestamp is still updated to reflect the latest lookup

### Requirement: Persist lookup history across restarts
The system SHALL persist the lookup history to a local file so that the upload page reflects prior searches after the server is restarted.

#### Scenario: Restart preserves history
- **WHEN** the user looks up several words, stops the server, and starts it again
- **THEN** the previously looked-up words remain available on the upload page with their cached Cambridge entries

#### Scenario: Repeat lookup deduplicates by word
- **WHEN** the user looks up a word that already exists in the history (case-insensitive match)
- **THEN** the existing entry is updated in place (timestamp refreshed, entry replaced) rather than appended as a duplicate
