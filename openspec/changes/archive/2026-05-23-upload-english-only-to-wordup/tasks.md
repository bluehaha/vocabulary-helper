## 1. Update payload builder

- [x] 1.1 In `server/wordup.js`, change `buildPayload` so `translations` is the deduplicated non-empty English `def.text` values (replacing the previous Chinese `def.translation`).
- [x] 1.2 In `server/wordup.js`, change `buildPayload`'s example loop so only `ex.text` is pushed onto `sentences` (drop `ex.translation`). Keep the empty-string filter.

## 2. Verify

- [x] 2.1 Run `node -e` (or a scratch script) that calls `buildPayload` with a representative entry containing Chinese `translation` fields and assert: `translations` contains the deduped English `def.text` values, `sentences` contains no Chinese strings, English ordering is preserved, `force_create` and `deck_id` are unchanged.
- [x] 2.2 Start the server (`pnpm run dev`), upload a word with a configured WordUp deck, and confirm the created card in WordUp shows only English (no Chinese translations or example glosses from our side).
