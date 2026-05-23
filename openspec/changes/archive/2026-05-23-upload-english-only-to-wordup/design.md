## Context

`server/wordup.js` builds the WordUp `cards` payload by extracting both the Chinese translation of each Cambridge definition (`d.translation`) and, for every example, pushing the English `text` followed immediately by the Chinese `translation` onto a single flat `sentences` array. The result is a card whose `translations` field is a list of Traditional Chinese glosses and whose `sentences` field interleaves English and Chinese strings.

WordUp produces its own translations server-side from the English source. The locally-scraped Chinese was therefore redundant, occasionally lower-quality, and produced cluttered cards. The Cambridge entries cached in history still carry the Chinese fields - the search UI uses them - so the filter only needs to apply at payload-construction time.

## Goals / Non-Goals

**Goals:**
- Payload sent to `POST /api/v1/cards` contains only English content (headword + English definitions + English example texts).
- `translations` carries the deduplicated non-empty English `def.text` values from the Cambridge entry (WordUp's `translations` is the "what this word means" field shown under 解釋, not a foreign-language gloss field).
- `sentences` contains only the example `text` values, in their original order, with empties dropped.
- Behavior is unconditional - there is no per-upload toggle.

**Non-Goals:**
- Changing the cached Cambridge entry shape or the search/history UI.
- Re-fetching from Cambridge in English-only mode.
- Filtering Chinese characters out of strings that are nominally English (we trust Cambridge's `eg.deg` content).
- Removing the `translation` field from `example` objects in history.

## Decisions

**Filter at `buildPayload`, not at scrape time.**
The Cambridge scraper and history layer stay untouched; only `buildPayload` in `server/wordup.js` changes. Rationale: the UI still wants Chinese, and history is the source for both UI and upload. Filtering at the upload boundary is the smallest change that satisfies the requirement. Alternative considered: a second "english-only" entry shape stored alongside the full entry - rejected as duplication for no benefit.

**Use English definitions for `translations`, not an empty array.**
WordUp's `text_content.explanations[0].translations` is the field rendered as the card's "meaning" (the 解釋 section in the WordUp UI), not a foreign-language gloss field. Sending `[]` removed the Chinese but also removed the meaning entirely, leaving cards with only example sentences. Filling it with the deduplicated English `def.text` values keeps the card meaningful while still containing zero Chinese. Alternatives considered: sending a single concatenated definition string (rejected - loses the per-sense structure); omitting the key (rejected - leaves the card meaningless and is a larger shape change).

**Drop example `translation` entirely from `sentences`.**
Do not attempt to detect language; just stop pushing `ex.translation`. Rationale: the field is by construction the Chinese gloss of the example, so a blanket drop is correct. Detecting "is this English" would be fragile and unnecessary.

## Risks / Trade-offs

- **[Risk] Existing cards already uploaded with Chinese remain in WordUp.** → Mitigation: out of scope; this change affects future uploads only. The user can edit or recreate old cards in WordUp if desired.
- **[Risk] User may later want Chinese back.** → Mitigation: behavior is centralized in one function; reverting is a small, contained edit. No data is lost from the local history.
- **[Trade-off] No language detection means we trust Cambridge's `eg.deg` to be English.** This has held in practice for the `en-tw` source we scrape; if a future Cambridge layout change pollutes that field, it will surface as unexpected content in uploads.
