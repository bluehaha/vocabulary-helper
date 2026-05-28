## Context

`server/wordup.js#buildPayload` flattens the cached Cambridge entry into a single WordUp explanation. The cached entry already contains an `entry.verbs` array (populated by `server/cambridge.js#fetchVerbs` from Simple Wiktionary's inflection table) with items shaped like `{ id, type, text }` where `type` is e.g. `"Plain form"`, `"Third-person singular"`, `"Past tense"`, `"Past participle"`, `"Present participle"`. The table can list multiple groups (a noun-style row of `Singular`/`Plural` followed by one or two verb conjugation blocks); each verb block typically has its own `Plain form`, `Past tense`, `Past participle`.

WordUp's payload schema (already in use) gives us `text_content.explanations[0].translations` as a free-form list of strings. There is no dedicated inflection field, so anything we want to show on the card has to live inside one of the existing string arrays.

## Goals / Non-Goals

**Goals:**
- For irregular verbs only, surface the past tense and past participle on the WordUp card so the user does not have to look them up separately.
- Keep the payload byte-for-byte unchanged for regular verbs and non-verbs.
- Make the irregularity decision from data already in `entry.verbs` — no extra HTTP requests.

**Non-Goals:**
- Surfacing the third-person singular, plain form, or present participle (gerund) — those are predictable from the base or already on the card via the headword.
- Splitting verbs from nouns into separate explanations for mixed-POS words like `sting`.
- Exposing a UI toggle to include/exclude inflections.
- Fixing or normalizing the Wiktionary inflection table — we trust whatever `entry.verbs` already contains.

## Decisions

**Placement: prepend ONE line to `translations`.**
- The new line is inserted as element 0 of `text_content.explanations[0].translations`, before all definition lines.
- Shape: `"<past tense> | <past participle>"` — both forms verbatim, separated by ` | `, with no POS prefix or labels.
- Both forms are always written out even when they match (`stung | stung`) — user preference: consistent shape over collapsing.
- Why prepend rather than append: the card surfaces translations top-down; the inflection summary is most useful at a glance before the user scrolls into definitions.
- Why the bare `<past> | <pp>` form rather than labels like `"past: sang, past participle: sung"`: the user finds the labels noisy on the WordUp card. The pipe-separated pair reads as a verb conjugation at a glance, and the `(v)` prefix on the line below makes it clear we are looking at a verb.
- The line is `unshift`ed AFTER the definition dedup pass. The literal `" | "` separator and lowercase verb forms cannot collide with any `"(<pos>) ..."` definition line.

**Detection: compare `Past tense` to the regular form computed from `Plain form`.**
- Pull the first `Plain form` entry (`base`) and the first `Past tense` entry (`past`) from `entry.verbs` by their `type` label.
- Compute the candidate regular forms from `base`:
  - if `base` ends in `e` (e.g. `like`): regular is `base + "d"` (`liked`).
  - else if `base` ends in a consonant followed by `y` (e.g. `try`, `study`): regular is `base.slice(0,-1) + "ied"` (`tried`).
  - else if `base` ends in a single vowel followed by a single consonant other than `w`, `x`, `y` AND is a single syllable (heuristic: short word, ≤ 5 chars): also accept the doubled-consonant form `base + base.slice(-1) + "ed"` (`stop` → `stopped`).
  - always accept the plain `base + "ed"` form (`walked`) as regular.
- If `past.toLowerCase()` matches any of the accepted regular candidates, the verb is regular → no inflection line.
- Otherwise it is irregular → emit the inflection line.
- Why a candidate list rather than a single rule: English spelling rules are ambiguous enough at the edges (e.g. `stop` → `stopped`, `prefer` → `preferred`, `travel` → `travelled`/`traveled`) that "accept any standard candidate" is more forgiving than "compute the one true regular form." The cost of a false positive (regular verb gets an inflection line) is one extra translation line; the cost of a false negative (irregular verb misses the line) is silent loss of useful info.

**`Past participle` is taken as-is.**
- We do not run a separate regularity check on the past participle. If the past tense is irregular, English convention is that the past participle is also worth showing (it is usually distinct from the past tense and the base form for "strong" verbs).
- If `entry.verbs` lacks a `Past participle` row but has a `Past tense` row, fall back to using the past tense for both slots (some defective entries lack the pp row in Wiktionary).

**Trigger condition: `entry.pos` includes `"verb"` AND both `base` and `past` are present.**
- The `entry.pos` check protects pure nouns (`book`, `apple`) that happen to have a verb-shaped inflection table on Wiktionary.
- Missing `Plain form` or `Past tense` → silent skip (no line, upload still succeeds).
- Empty `entry.verbs` → silent skip.

**Multiple verb blocks in `entry.verbs`.**
- `entry.verbs` can contain a noun block followed by one or two verb blocks (the `sting` fixture has Singular/Plural then two verb conjugations). We resolve `base` and `past` by selecting the FIRST `Plain form` and the FIRST `Past tense` entries by `type` match, scanning in array order.
- Why first-match rather than nth-block parsing: it is robust to layout drift and the first verb block on Wiktionary is the principal conjugation. Subsequent blocks (rare, e.g. archaic forms) are ignored intentionally.

## Risks / Trade-offs

- [Heuristic regularity check has edge cases (e.g. `panic` → `panicked` adds a `k`)] → Such forms will be classified as irregular and get an inflection line — extra noise but not wrong information. The line still helps the user.
- [Wiktionary inflection table may be missing or mis-parsed for some words] → `fetchVerbs` already swallows errors and returns `[]`; we silently skip the inflection line and the rest of the upload proceeds unchanged.
- [Cached entries written before this change have a `verbs` array already] → `fetchVerbs` has been part of the scraper since the dictionary-lookup capability was introduced (`entry.verbs` is always present, possibly `[]`), so cached entries on disk already carry it.
- [Verbs with multiple distinct conjugations (e.g. `hang` → `hung`/`hanged`)] → We surface only the FIRST verb block from Wiktionary. The user loses the alternate form. Accepted: covering split conjugations would need a multi-line representation and a meaningful UI in WordUp, which is out of scope here.
- [Doubled-consonant detection is heuristic (single-syllable length check)] → Multi-syllable verbs with doubled consonants (`prefer` → `preferred`, `commit` → `committed`) may be misclassified as irregular. Accepted same way as above — the cost is an extra (correct) line, not a wrong one.
