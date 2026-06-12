## MODIFIED Requirements

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
