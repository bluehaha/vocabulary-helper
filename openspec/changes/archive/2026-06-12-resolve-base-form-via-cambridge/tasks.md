## 1. Parse the inflected-form marker from Cambridge

- [x] 1.1 In `server/cambridge.js#parseEntry`, scan definition blocks for the inflected-form usage label: read the `.usage.dusage` text within each `.def-block.ddef_block` and match it (trimmed, lowercased) against the set `{ "past simple of", "past tense of", "past participle of", "past simple and past participle of" }`.
- [x] 1.2 For the FIRST matching block (document order), read the base word from its cross-reference link — the trimmed text of `.x.dx .x-h.dx-h` (fallback: the decoded last path segment of `.x.dx a[href]`). Expose it from `parseEntry` as an internal field (e.g. `baseRef`); leave the returned `entry` shape unchanged (`{ word, pos, verbs, pronunciation, definition }`).

## 2. Switch the resolution trigger

- [x] 2.1 In `fetchEntry`, replace the `basePlainForm(verbs)` trigger with `parsed.baseRef`: when `baseRef` exists and differs (case-insensitively) from the trimmed searched word, perform the second lookup, cache under the searched key, and return the base entry — keeping the existing failure fallback to the inflected-form entry.
- [x] 2.2 Remove `basePlainForm` if it is now unused (keep it only if still referenced elsewhere). Keep the `fetchVerbs(wikiUrl)` call and `entry.verbs` exactly as-is.

## 3. Verify

- [x] 3.1 Manually verify in the browser / via the API: `rugged` now returns the `rugged` adjective entry (not `rug`); `learned`, `aged`, `blessed`, `dogged` stay on their own entries.
- [x] 3.2 Verify resolution still works: `spat → spit`, `eaten → eat`, `ran → run`, `swum → swim` return the base-word entry; history dedup keys off the resolved word.
- [x] 3.3 Verify no regression to dependent features: the search-page past tense / past participle line still renders from `entry.verbs` (e.g. `eat` shows `ate · eaten`, bold), and the WordUp irregular-verb line is unaffected.
