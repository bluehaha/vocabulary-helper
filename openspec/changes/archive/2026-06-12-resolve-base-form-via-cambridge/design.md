## Context

`server/cambridge.js#fetchEntry` fetches a Cambridge page, parses it with `parseEntry`, and (since the `show-verb-base-form` change) resolves verb lookups to their base form. The current resolution trigger is:

```js
const base = basePlainForm(verbs);           // first Wiktionary "Plain form" row
if (base && base.toLowerCase() !== word.trim().toLowerCase()) {
  const baseResult = await fetchEntry(base, lang);
  ...
}
```

`verbs` comes from `fetchVerbs(wikiUrl)`, scraping Simple Wiktionary's inflection table. The bug: Wiktionary lists `rugged` as the past participle of the verb `rug`, so `basePlainForm` returns `rug` and the resolver re-fetches `rug` — even though `rugged` is a real adjective with its own Cambridge entry. The same happens for `learned`, `aged`, `blessed`, `dogged`.

Cambridge itself distinguishes the two cases reliably. A genuine inflected-form page has a definition shaped like:

```html
<div class="def-block ddef_block">
  <div class="def ddef_d db">
    <span class="lab dlab"><span class="usage dusage">past simple and past participle of</span></span>
    <span class="x dx"><a class="Ref" href="/dictionary/english/spit"><span class="x-h dx-h">spit</span></a></span>
  </div>
  ...
</div>
```

Real words (`rugged` → adjective) have normal definitions and no such "past … of" usage label.

The user's directive: stop using Wiktionary to decide the base-form jump; use Cambridge's own marker. Wiktionary stays in use for the search-page past tense / past participle display and the WordUp irregular-verb line (both read `entry.verbs`).

## Goals / Non-Goals

**Goals:**
- Resolve to the base form ONLY when the Cambridge page marks the searched word as an inflected form ("past simple of", "past tense of", "past participle of", "past simple and past participle of") and links to a base word.
- Read the base word from Cambridge's cross-reference link in that definition.
- Keep `spat→spit`, `eaten→eat`, `ran→run`, `swum→swim` resolving; stop `rugged→rug` and the other adjective/inflection collisions.
- Leave `entry.verbs` (Wiktionary) intact for the display and WordUp features.

**Non-Goals:**
- Removing the Wiktionary fetch or the `entry.verbs` field.
- Changing the WordUp payload, the search-page rendering, history schema, or the API shape.
- Resolving non-verb inflections (plurals, comparatives) — only the "past … of" verb markers are in scope, matching today's verb-only behavior.

## Decisions

**Decision: Detect the inflected-form marker from Cambridge's `usage`/`dusage` label.**
In `parseEntry`, for each definition block, capture the usage label text from `.def.ddef_d.db .lab.dlab .usage.dusage` (or equivalently the leading `.usage.dusage` within the def). A block is an inflected-form marker when that label, trimmed and lowercased, matches the regex `^past (simple|tense)( and past participle)? of$` OR `^past participle of$` — i.e. the set {"past simple of", "past tense of", "past participle of", "past simple and past participle of"}. Using the dedicated `dusage` node (not a substring search of the whole definition text) avoids matching a normal definition that merely contains the words "past tense of".
- *Alternative considered:* substring-match "of" in the def text. Rejected — too loose; ordinary definitions contain "of".

**Decision: Read the base word from the same block's cross-reference link.**
From the marker block, take the base word as the trimmed text of `.x.dx .x-h.dx-h` (fallback: the last path segment of the `.x.dx a[href]` URL, decoded). This is `spit` for `spat`. If the marker block has no usable cross-reference text, treat the entry as not resolvable (no jump) rather than guessing.

**Decision: Surface the marker via a parsed field, then branch in `fetchEntry`.**
`parseEntry` returns an additional internal field, e.g. `baseRef` = the resolved base word string (or `undefined`), computed from the first marker block in document order. `fetchEntry` replaces the `basePlainForm(verbs)` trigger with:

```js
const base = parsed.baseRef;
if (base && base.toLowerCase() !== word.trim().toLowerCase()) {
  const baseResult = await fetchEntry(base, lang);
  if (baseResult.status === "ok") { setCached(key, baseResult.entry); return baseResult; }
  // else fall through to the inflected-form entry (unchanged fallback)
}
```

`baseRef` is NOT added to the returned `entry` object (the entry shape stays `{ word, pos, verbs, pronunciation, definition }`); it is only used for the jump decision. Recursion still terminates: a base word's own page has no "past … of" marker pointing elsewhere, so `baseRef` is undefined for it.
- *Alternative considered:* keep `basePlainForm` as a secondary trigger. Rejected — that reintroduces the `rugged` bug.

**Decision: Keep `fetchVerbs`/`entry.verbs` exactly as-is.**
The Wiktionary scrape still runs and populates `entry.verbs` for the past tense / past participle display (`public/search.js`) and the WordUp irregular line (`server/wordup.js`). Only the resolution trigger changes. `basePlainForm` is removed if it becomes unused after the trigger change.

## Risks / Trade-offs

- **Cambridge changes its `dusage`/`Ref` markup** → resolution silently stops (words show their inflected-form page). Mitigation: the parse degrades to "no jump" (returns the fetched entry), which is safe — never a wrong word. The selectors live next to the existing definition parse and are covered by the verification tasks.
- **An inflected form whose Cambridge page lacks the usage label** (rare) → it won't resolve. Acceptable: better to show the literal page than to mis-resolve a real word. This is the deliberate trade-off that fixes `rugged`.
- **Two parses of the same DOM** (definition + marker) → negligible; both run inside the existing single `cheerio.load`.
- **Label wording variants** (e.g. British vs American phrasing) → the regex covers the known set; if Cambridge uses a phrase outside the set, that form won't resolve (safe degrade). The set can be extended if a real example surfaces.
