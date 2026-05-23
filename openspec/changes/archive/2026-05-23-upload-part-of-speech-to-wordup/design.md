## Context

`server/wordup.js#buildPayload` currently flattens the cached Cambridge entry into a single WordUp explanation with `word_types: []` and bare-text translations. The cached entry already includes per-definition `pos` (e.g. `"verb"`, `"noun"`) populated by `server/cambridge.js#parseEntry`. WordUp accepts `word_types` as an array of strings on each explanation, and renders each translation line verbatim.

## Goals / Non-Goals

**Goals:**
- Populate `word_types` on the single explanation with the deduplicated parts of speech from the cached entry (card-level header).
- Prefix each translation line with an abbreviated part-of-speech marker like `(v)`, `(n)`, `(adj)` so the part of speech is visible per definition on the card.
- Keep the existing single-explanation payload shape — no other field changes.

**Non-Goals:**
- Splitting one card into multiple explanations grouped by part of speech.
- Letting the user pick or override the part of speech or the abbreviation in the UI.
- Forwarding any Chinese content (continues to be excluded).
- Changing how `sentences` are rendered.

## Decisions

**Source of `word_types`: per-definition `def.pos`, not the entry-level `entry.pos` array.**
- `entry.pos` is a deduplicated list across the whole entry; `def.pos` is the part of speech actually attached to each definition (the one whose `def.text` becomes a translation).
- Since translations are derived from `def.text`, the matching `def.pos` values are the truthful tag for those translations.
- Build `word_types` as the deduplicated, order-preserving list of non-empty `def.pos` values from the same definitions used to build `translations`.
- Why not `entry.pos`: it can include parts of speech that have no English definition (e.g. a Chinese-only sense), which would mislabel the card.

**Per-line POS marker: `"(<abbrev>) <text>"`.**
- Each translation line is constructed by joining the abbreviated `def.pos` (in parentheses, followed by a space) with the trimmed `def.text` from the same definition.
- Definitions with empty/missing `pos` keep the bare text (no parentheses, no leading space).
- Dedup happens on the final composed string, so two `verb` definitions with the same `def.text` collapse to one line — but a `verb` and `noun` definition that happen to share `def.text` produce two distinct lines (`"(v) X"`, `"(n) X"`).

**Abbreviation map.**
```
verb        → v
noun        → n
adjective   → adj
adverb      → adv
preposition → prep
pronoun     → pron
conjunction → conj
determiner  → det
exclamation → excl
```
- Unknown values (e.g. `"modal verb"`, `"auxiliary verb"`) pass through verbatim and are wrapped in parentheses as-is (`"(modal verb) ..."`). Spelling out the rare cases beats silently dropping them.
- Mapping happens in a small local lookup; no new module.

**Single explanation, multiple `word_types`.**
- WordUp's `word_types` is already an array, so a word like `"shake"` (verb + noun) becomes one explanation tagged with both. Per-line `(v)` / `(n)` then disambiguates each translation visually.
- Alternative considered: emit one explanation per part of speech. Rejected — larger payload change, alters how cards render on WordUp, and not asked for.

**Fallback when no part of speech is present.**
- If every definition lacks `pos` (older cache entries, parse failure), `word_types` is `[]` and translations are bare text — identical to the pre-change behavior.

## Risks / Trade-offs

- [`word_types` plus per-line `(v)` is mildly redundant] → User has confirmed they want both: the header gives a quick card-level summary, the per-line marker disambiguates each definition. Accept the redundancy.
- [Cached entries from before this change may lack `def.pos` on disk] → `def.pos` has been populated by the scraper since the dictionary-lookup capability was introduced; if any field is missing we emit bare text and `[]`, and the upload still succeeds.
- [WordUp may reject unknown `word_types` strings] → We forward Cambridge's part-of-speech labels verbatim; if a value is rejected we'll see it in the per-word failure report and can normalize later.
- [Abbreviation map drift over time as Cambridge adds new POS labels] → Unknown values pass through as the full word in parentheses, so the worst case is a slightly verbose tag rather than a missing one.
