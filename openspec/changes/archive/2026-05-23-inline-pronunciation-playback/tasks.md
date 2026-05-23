## 1. Replace pronunciation anchor with play button

- [x] 1.1 In `public/search.js` `renderEntry`, change the pronunciation markup so the audio control is a `<button type="button" class="audio" data-url="${p.url}" aria-label="Play pronunciation" aria-pressed="false">▶</button>` (omit the button entirely when `p.url` is missing).
- [x] 1.2 After setting `resultEl.innerHTML`, wire up the new buttons inside `renderEntry`'s closure with a shared `let currentAudio = null; let currentButton = null;` and a `playFromButton(btn)` handler.
- [x] 1.3 In `playFromButton`: if `currentAudio` exists, `pause()` it and reset `currentButton` (remove `audio--playing`, set `aria-pressed="false"`, restore `▶`). If the clicked button was the one that was playing, stop and return (toggle-off behavior).
- [x] 1.4 Otherwise construct `new Audio(btn.dataset.url)`, attach `ended` and `error` listeners that reset the button state and clear `currentAudio`/`currentButton`, then call `audio.play()` synchronously inside the click handler and update the button (`audio--playing` class, `aria-pressed="true"`, glyph `⏸`).
- [x] 1.5 If `audio.play()` returns a promise that rejects, reset the button state and call `showStatus("error", \`Could not play audio: ${err.message}\`)`.

## 2. Style the play button

- [x] 2.1 In `public/styles.css`, add or adapt a `.audio` rule so the new `<button>` reads visually like the old anchor (same glyph size, no default button chrome — no border, transparent background, pointer cursor, inherit colour).
- [x] 2.2 Add an `.audio.audio--playing` rule (or use `[aria-pressed="true"]`) that gives a subtle indicator the audio is currently sounding (e.g., colour shift).

## 3. Verify

- [x] 3.1 Start the server (`pnpm start` or the project's run command), open the search page, look up a word with a known pronunciation (e.g., "hello"), and confirm clicking ▶ plays the audio on the same page with no new tab.
- [x] 3.2 With audio playing, click a different pronunciation button on the same result and confirm the first one stops before the second starts.
- [x] 3.3 Click the same button again while it is playing and confirm it stops (toggle-off).
- [x] 3.4 Simulate a broken audio URL (e.g., temporarily edit the entry's `url` in DevTools to a 404) and confirm the page shows an error and the button returns to idle.
