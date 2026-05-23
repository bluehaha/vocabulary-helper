# Word Queue Management

### Requirement: View the queue of looked-up words
The system SHALL provide an upload page that lists every word currently in the local history, most-recent lookup first, showing the word, the time it was last looked up, and a short preview (first translation or definition).

#### Scenario: Opening the upload page with history
- **WHEN** the user navigates to the upload page and the history is non-empty
- **THEN** the page renders one row per stored word, sorted by `lookedUpAt` descending
- **AND** each row displays the word, the relative or absolute lookup time, and a short preview taken from the first definition or translation

#### Scenario: Opening the upload page with an empty history
- **WHEN** the user navigates to the upload page and no words have been looked up yet
- **THEN** the page shows an empty-state message indicating that lookups will appear here

### Requirement: Single-select and multi-select words
The system SHALL allow the user to select one or more words from the list via per-row checkboxes plus a "select all" control.

#### Scenario: Selecting individual rows
- **WHEN** the user toggles a row's checkbox
- **THEN** that row is marked selected and the action bar reflects the new selection count

#### Scenario: Select-all toggle
- **WHEN** the user toggles the "select all" checkbox
- **THEN** every visible row's selection state matches the "select all" state

### Requirement: Delete selected words from the queue
The system SHALL allow the user to remove one or more selected words from the local history, after which they no longer appear on the upload page.

#### Scenario: Deleting selected words
- **WHEN** the user has at least one row selected and triggers the delete action
- **THEN** the system removes those words from `data/history.json`
- **AND** the upload page no longer lists them
- **AND** the in-memory scraping cache is unaffected (so re-looking them up does not re-hit Cambridge within the TTL)

#### Scenario: Delete action is disabled with no selection
- **WHEN** no rows are selected
- **THEN** the delete control is disabled or hidden, and triggering it has no effect

### Requirement: Persistence of queue state
The system SHALL persist all queue mutations (additions from lookups, deletions, successful uploads) to the local history file synchronously so that state is consistent across page reloads and server restarts.

#### Scenario: Concurrent modifications do not corrupt the file
- **WHEN** two write operations (e.g., a lookup and a delete) execute close together
- **THEN** both modifications are applied and the resulting `history.json` is valid JSON reflecting both changes
