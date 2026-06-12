# Dictionary Lookup

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

### Requirement: Resolve verb lookups to their base-form entry
When a lookup's fetched Cambridge entry is marked by Cambridge itself as an inflected form of a base word that differs (case-insensitively) from the word the user searched, the system SHALL perform a second Cambridge lookup for that base word and return the base-word entry — its definitions, examples, pronunciation, and headword — in place of the inflected-form entry. This ensures the displayed content is the base form's real entry, not Cambridge's inflected-form page (whose definition is typically just "past simple and past participle of ...").

The inflected-form signal is Cambridge's own usage label on a definition: a definition whose usage label (trimmed, case-insensitive) is one of `"past simple of"`, `"past tense of"`, `"past participle of"`, or `"past simple and past participle of"`. The base word is read from that same definition's cross-reference link (the linked base headword). The decision MUST come from this Cambridge marker, NOT from the Simple Wiktionary inflection table (`entry.verbs`): a word that is a real headword in its own right (e.g. the adjective `rugged`, which Wiktionary also lists as the past participle of the verb `rug`) has no such Cambridge usage label and MUST NOT be resolved to a base form. The decision MUST NOT be gated on the Cambridge `pos`, because Cambridge sometimes returns an empty `pos` for inflected-form pages (e.g. `ran`, `went`).

The Simple Wiktionary scrape that populates `entry.verbs` is still performed and still drives the search-page past tense / past participle display and the WordUp irregular-verb line; only the base-form resolution decision stops depending on it.

The resolution happens once, server-side, at fetch time, so the search result, the history record, the upload-page word column, and the WordUp payload all observe the same resolved base-word entry. The recursive resolution terminates because a base word's own Cambridge page carries no inflected-form usage label pointing elsewhere, so no second lookup is triggered for it.

#### Scenario: Verb searched by its past tense and past participle form
- **WHEN** the user looks up `spat`, whose Cambridge entry has a definition labeled "past simple and past participle of" linking to `spit`
- **THEN** the system performs a second lookup for `spit`
- **AND** the returned entry is the `spit` entry — its headword is `spit` and its definitions are the real `spit` definitions (e.g. "to force out the contents of the mouth ..."), not "past simple and past participle of ..."
- **AND** the history records the word as `spit`

#### Scenario: Verb searched by its past participle form
- **WHEN** the user looks up `eaten`, whose Cambridge entry has a definition labeled "past participle of" linking to `eat`
- **THEN** the returned entry is the `eat` entry with `eat`'s definitions and headword

#### Scenario: Inflected form whose Cambridge page has no part of speech
- **WHEN** the user looks up `ran`, whose Cambridge entry has an empty `pos` but has a definition labeled "past simple of" linking to `run`
- **THEN** the system still performs a second lookup for `run` and returns the `run` entry
- **AND** the resolution is NOT skipped merely because `pos` is empty

#### Scenario: Real adjective that coincides with a verb inflection is not resolved
- **WHEN** the user looks up `rugged`, which Cambridge classifies as an adjective with its own definitions and NO "past … of" usage label, even though Simple Wiktionary lists `rugged` as the past participle of the verb `rug`
- **THEN** no second lookup is performed
- **AND** the returned entry is the `rugged` adjective entry, NOT `rug`
- **AND** the history records the word as `rugged`

#### Scenario: Verb already searched by its base form
- **WHEN** the user looks up `eat`, whose Cambridge page has no inflected-form usage label
- **THEN** no second lookup is performed
- **AND** the `eat` entry is returned directly

#### Scenario: Word with no inflected-form marker is not resolved
- **WHEN** the user looks up a word whose Cambridge entry has no definition with a "past … of" usage label (e.g. a noun, an adjective, or a base-form verb)
- **THEN** no second lookup is performed and the fetched entry is returned unchanged

#### Scenario: Marked base word equals the searched word
- **WHEN** the fetched entry's inflected-form usage label links to a base word that matches the searched word (case-insensitively)
- **THEN** no second lookup is performed and the fetched entry is returned unchanged
- **AND** the lookup still succeeds

#### Scenario: Base-word lookup fails
- **WHEN** the marked base word differs from the searched word but the second Cambridge lookup returns `not_found` or an error
- **THEN** the system falls back to the originally-fetched inflected-form entry rather than failing the search

#### Scenario: Multiple inflected-form markers on the page
- **WHEN** the fetched entry has more than one definition carrying a "past … of" usage label
- **THEN** the FIRST such marker (by document order) with a usable linked base word is used as the base word
- **AND** later markers are ignored

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

#### Scenario: Repeat lookup deduplicates by canonical word
- **WHEN** the user looks up a word whose canonical word already exists in the history (case-insensitive match on the canonical word)
- **THEN** the existing entry is updated in place (timestamp refreshed, entry replaced) rather than appended as a duplicate

#### Scenario: Inflected and base forms of the same verb deduplicate
- **WHEN** the user looks up `spat` (canonical word `spit`) and later looks up `spit`
- **THEN** both resolve to a single history row keyed by `spit`
- **AND** the row is updated in place on the second lookup rather than appended as a duplicate

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

### Requirement: Show verb past tense and past participle on the result

When a rendered entry is a verb, the search page SHALL display the verb's past tense and past participle in the result header, directly beneath the headword and parts of speech and before the definitions. The forms are drawn verbatim from `entry.verbs`: the first row whose `type` is `"Past tense"` (with non-empty trimmed text) and the first row whose `type` is `"Past participle"` (with non-empty trimmed text). The line is shown for ALL verbs that carry these rows, regular and irregular.

An entry is treated as a verb for this purpose when `entry.verbs` contains a `"Past tense"` row and/or a `"Past participle"` row with non-empty text; this MUST NOT be gated on the Cambridge `pos`, which is sometimes empty for verb pages. When neither a `"Past tense"` nor a `"Past participle"` row with non-empty text is present, NO verb-forms line is rendered.

For irregular verbs, the displayed forms SHALL be rendered in bold. A verb is irregular when its `entry.verbs` has a `"Plain form"` row (base) and a `"Past tense"` row (past) where the past tense is NOT the form produced by the regular rule applied to the base: `base + "ed"`; `base + "d"` when the base ends in `e`; `base` with a trailing `consonant + y` replaced by `ied`; or a final short-vowel+consonant base with the consonant doubled before `ed`. When the base form or past tense is missing, the verb is treated as regular (forms not bolded). Regular verbs' forms SHALL be rendered in normal (non-bold) weight.

This requirement is presentation-only and does not change the lookup, history, or WordUp payload behavior.

#### Scenario: Irregular verb shows bold past tense and past participle
- **WHEN** the user looks up `spit`, whose `entry.verbs` includes `{ type: "Plain form", text: "spit" }`, `{ type: "Past tense", text: "spat" }`, and `{ type: "Past participle", text: "spat" }`
- **THEN** the result header displays a verb-forms line showing `spat` (past tense) and `spat` (past participle)
- **AND** because `spat` is not the regular `-ed` form of `spit`, the displayed forms are rendered in bold

#### Scenario: Regular verb shows non-bold past tense and past participle
- **WHEN** the user looks up `walk`, whose `entry.verbs` includes `{ type: "Plain form", text: "walk" }`, `{ type: "Past tense", text: "walked" }`, and `{ type: "Past participle", text: "walked" }`
- **THEN** the result header displays a verb-forms line showing `walked` and `walked`
- **AND** because `walked` is the regular `-ed` form of `walk`, the displayed forms are rendered in normal (non-bold) weight

#### Scenario: Verb page with empty part of speech still shows the forms
- **WHEN** the user looks up a verb whose entry has an empty `pos` but whose `entry.verbs` includes non-empty `"Past tense"` and `"Past participle"` rows
- **THEN** the verb-forms line is still rendered
- **AND** the line is NOT suppressed merely because `pos` is empty

#### Scenario: Non-verb entry shows no verb-forms line
- **WHEN** the user looks up a noun or adjective whose `entry.verbs` has no `"Past tense"` or `"Past participle"` row with non-empty text
- **THEN** no verb-forms line is rendered in the header
- **AND** the rest of the result (headword, parts of speech, pronunciation, definitions) is unchanged from before this change

#### Scenario: Only one inflected form is available
- **WHEN** the entry's `entry.verbs` has a `"Past tense"` row with non-empty text but no `"Past participle"` row with non-empty text (or vice versa)
- **THEN** the verb-forms line is rendered showing only the available form
