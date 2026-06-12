## Why

When a verb entry is displayed on the search page, the user sees its definitions but not its past tense or past participle — they have to remember the conjugation or look it up elsewhere. The scraped entry already carries the inflected forms (`entry.verbs`), so we can surface them directly on the result. Showing them inline (and bolding irregular forms) makes the conjugation immediately visible, with irregular verbs — the ones worth memorizing — visually emphasized.

## What Changes

- When a displayed entry is a verb (its `entry.verbs` contains a `Past tense` and/or `Past participle` row), the search page SHALL render a verb-forms line in the result header, directly beneath the headword and parts of speech.
- The line shows the past tense and past participle (e.g. `walked · walked`, `spat · spat`), drawn verbatim from `entry.verbs`. This is shown for ALL verbs, regular and irregular.
- For irregular verbs (the `Past tense` is NOT the regular `Plain form + -ed/-d/-ied` form), the displayed forms are rendered in **bold** to emphasize them. Regular verbs' forms render in normal weight.
- When the entry is not a verb, or has no `Past tense` / `Past participle` rows, NO verb-forms line is rendered (no change to current output for nouns, adjectives, etc.).
- No new HTTP endpoints, no server-side changes, no env/config changes. The `entry.verbs` data is already present in the API response; this is a presentation-only change on `public/search.js` and `public/styles.css`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `dictionary-lookup`: the "Search a word via the search page" requirement gains a rule that, for verb entries, the rendered result includes the past tense and past participle in the header, with irregular forms shown in bold.

## Impact

- `public/search.js` — `renderEntry` reads `entry.verbs`, picks the first `Past tense` and `Past participle` rows, decides regular vs irregular (same `-ed/-d/-ied` rule already used server-side in `server/wordup.js`), and renders a verb-forms line in the header with a bold class applied when irregular.
- `public/styles.css` — a small style for the verb-forms line and its bold (irregular) variant.
- No changes to `server/cambridge.js`, `server/wordup.js`, history storage, or the upload page. The WordUp card payload is unaffected.
