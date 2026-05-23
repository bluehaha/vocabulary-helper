## Why

The pronunciation audio button on the search result is rendered as an `<a target="_blank">` to the raw `.mp3` URL, so clicking it opens a new browser tab to play the audio. This breaks the user's flow on the search page and is jarring on mobile. We want a "play in place" experience: click the speaker, hear the word, stay on the page.

## What Changes

- Replace each pronunciation audio anchor with an in-page play control (button) that plays the audio via the HTML `<audio>` API without leaving the page.
- Provide visual feedback while playing (e.g., the button reflects a playing state) and gracefully handle audio errors (network failure, blocked autoplay) without breaking the page.
- Allow multiple pronunciations to coexist; starting a new one stops any previously playing one so only one audio plays at a time.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `dictionary-lookup`: The "displays pronunciation entries with audio URL" behavior is refined to require in-page playback rather than navigating to the audio URL.

## Impact

- Affected code: `public/search.js` (renderEntry — pronunciation markup and a new playback handler), and `public/styles.css` (styling for the play button + playing state).
- No server, API, or data-shape changes. The Cambridge entry still carries `pronunciation[].url`; we just consume it differently on the client.
- No new dependencies.
