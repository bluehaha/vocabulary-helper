## ADDED Requirements

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
