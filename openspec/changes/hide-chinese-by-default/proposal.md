## Why

When practicing vocabulary, seeing the Chinese translation immediately removes the chance to self-test understanding from the English definition and example sentences alone. Hiding the Chinese by default turns each lookup into a small recall exercise, while keeping the translation one click away when needed.

## What Changes

- Hide Chinese translations on the search result page by default. This applies to both definition-level translations (`def__trans`) and example-level translations (`example__zh`).
- Add a single toggle control on the result view that reveals or re-hides all Chinese translations for the currently displayed entry.
- The toggle state resets to "hidden" each time a new word is rendered (no cross-lookup persistence required).
- The underlying dictionary data and API responses are unchanged — only the rendered visibility changes.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `dictionary-lookup`: The rendered search result must hide Chinese translations by default and expose a user-controlled toggle to show them.

## Impact

- Affected files: `public/search.html`, `public/search.js`, `public/styles.css`.
- No server, API, or data-shape changes (`server/cambridge.js` and the `/api/dictionary/:word` response are untouched).
- No new dependencies.
