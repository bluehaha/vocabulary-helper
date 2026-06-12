## Context

The search page renders a Cambridge entry via `renderEntry` in `public/search.js`. The entry object returned by `GET /api/dictionary/:word` already includes an `entry.verbs` array of `{ id, type, text }` rows scraped from Simple Wiktionary's inflection table (e.g. `type` = `"Plain form"`, `"Past tense"`, `"Past participle"`, `"Present participle"`). The server already resolves inflected-form verb lookups to their base form before returning, so a verb's `entry.verbs` reflects that base form's conjugation.

Today the header shows the headword, parts of speech, and pronunciations; `entry.verbs` is sent to the client but never displayed on the search page. It is only consumed server-side by `server/wordup.js#buildPayload`, which prepends an inflection line to the WordUp card **only for irregular verbs**, using a regularity check `isRegularPast(base, past)`.

The user wants the past tense and past participle shown on the search result for **all** verbs, with **irregular** forms emphasized in bold.

## Goals / Non-Goals

**Goals:**
- Display past tense and past participle in the result header (under the headword) for every verb entry that carries those rows.
- Render irregular verbs' forms in bold; regular verbs' forms in normal weight.
- Reuse the exact regular-vs-irregular rule already used server-side so the bolding is consistent with WordUp's irregular-only inflection line.
- Presentation-only: no server, history, or upload-payload changes.

**Non-Goals:**
- Changing the WordUp card payload or its irregular-only logic.
- Showing other inflections (third-person singular, present participle, plural/singular noun rows).
- Re-scraping or normalizing the inflection table — trust `entry.verbs` as received.
- Any change to the upload page.

## Decisions

**Decision: Pick the first `Past tense` and first `Past participle` rows by `type`, mirroring the server's selection.**
`server/wordup.js` uses `findVerbForm(verbs, type)` — the first row of a given `type` with non-empty trimmed text. The client will use the same selection so the displayed forms match what WordUp would use. The base form for the regularity check is the first `Plain form` row (same source the server's `basePlainForm`/`findVerbForm` use).
- *Alternative considered:* derive past tense from the headword with a rule. Rejected — the scraped forms are authoritative (handles suppletive forms like `go → went`), and we already have them.

**Decision: Determine "verb" by the presence of a `Past tense` or `Past participle` row, not by `entry.pos`.**
Consistent with the existing server-side resolution note that Cambridge sometimes returns an empty `pos` for inflected-form pages. If neither inflection row is present, render nothing. This keeps nouns/adjectives unaffected (they have no such rows).

**Decision: Port `isRegularPast` to the client verbatim.**
Copy the same `-ed / -d (after e) / -ied (consonant+y) / doubled-consonant -ed` rule from `server/wordup.js` into `search.js`. Irregular = has both a `Plain form` and a `Past tense` and `isRegularPast(base, past)` is false. When the base or past is missing, treat as regular (no bold) — we only bold when we can positively confirm irregularity.
- *Alternative considered:* have the server compute and send an `irregular` flag. Rejected for this change — it would touch the server and the API shape for a purely visual decision the client can make from data it already has. A small duplicated helper is the lighter change; the duplication is noted as a trade-off below.

**Decision: Render a single header line `past · pastParticiple`.**
A compact line placed after `entry__pos`, before the toolbar. Separator `·`. When the entry is irregular, the whole line carries a modifier class that applies bold. When only one of the two forms exists, show just that one. HTML is composed the same way as the rest of `renderEntry` (template string), and the form text is inserted as-is, consistent with how the existing code inserts scraped fields.

## Risks / Trade-offs

- **Duplicated regularity logic** (client copy of `isRegularPast`) → If the server rule changes, the two can drift. Mitigation: a code comment in `search.js` pointing at `server/wordup.js` as the source of truth; the rule is small and stable.
- **Scraped forms may be empty/odd for some verbs** → We only render rows with non-empty trimmed text and skip the line entirely when neither form is present, so a missing table degrades to today's output.
- **Bolding a regular verb (or failing to bold an irregular one) due to the heuristic** → Cosmetic only; the forms are still correct and visible. The heuristic already governs the WordUp card, so behavior is at least consistent across the app.
