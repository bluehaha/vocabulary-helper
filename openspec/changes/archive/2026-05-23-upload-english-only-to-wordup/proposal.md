## Why

The current WordUp upload payload mixes English and Chinese content: Chinese translations are sent as the card's `translations`, and each example's Chinese gloss is interleaved with the English sentence in `sentences`. WordUp generates its own Chinese translations from the English source, so uploading our locally-scraped Chinese duplicates that work, introduces unverified translations into the user's deck, and clutters cards with Chinese the user does not want there.

## What Changes

- Strip Chinese content from the WordUp upload payload: send only English content (English headword, English definitions, English example sentences).
- Send `text_content.explanations[0].translations` as the deduplicated non-empty English definition texts (`def.text`) from the Cambridge entry, replacing the previous Chinese `def.translation` values.
- Send `text_content.explanations[0].sentences` containing only the English `text` from each Cambridge example; drop the per-example Chinese `translation`.
- Local Cambridge entries in history are unchanged - this is purely an upload-time filter so the search UI keeps showing Chinese to the user.

## Capabilities

### New Capabilities
<!-- None - this only modifies behavior of an existing capability. -->

### Modified Capabilities
- `wordup-upload`: Payload construction no longer forwards Chinese translations or interleaved Chinese example glosses; only English content is uploaded.

## Impact

- `server/wordup.js` - `buildPayload` changes: drop Chinese translations, drop example `translation` interleaving.
- `openspec/specs/wordup-upload/spec.md` - "Construct the WordUp payload" requirement updated.
- No changes to history storage, Cambridge fetching, or UI.
- No new dependencies or config.
