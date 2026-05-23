## Context

`public/search.js` renders each pronunciation as `<a class="audio" href="${p.url}" target="_blank" rel="noopener">▶</a>`. The browser navigates to the raw `.mp3` URL in a new tab to play it. The audio URLs come from Cambridge (`https://dictionary.cambridge.org/.../...mp3`) and are already in the server response. The search page is a single static HTML page with no framework, and there is no audio playback infrastructure on the client today.

## Goals / Non-Goals

**Goals:**
- Clicking a pronunciation control plays the audio in place on the search page; no new tab, no navigation.
- Only one pronunciation plays at a time; starting a new one stops any prior playback.
- Visible playing state on the button so the user knows what is sounding.
- Graceful error handling when the audio fails to load or play.

**Non-Goals:**
- Pre-loading or caching of audio.
- A global audio player UI, playlist, or autoplay behavior.
- Changing the server response shape, the pronunciation parsing, or any other page (`upload.html`, etc.).
- Keyboard shortcuts or volume controls.

## Decisions

### Use the `HTMLAudioElement` API (`new Audio(url)`) instead of an inline `<audio>` element

The current markup is generated from a template string and rendered via `innerHTML`. We will keep that rendering style but emit a `<button>` per pronunciation with the audio URL stored in `data-url`. A single delegated click handler (or per-button handler bound after render) constructs an `Audio` object on demand and plays it. Rationale: avoids embedding N `<audio>` elements in the DOM, keeps markup small, and matches the page's existing minimalist approach. Alternative considered: per-pronunciation `<audio controls>` — rejected because it adds visual clutter and forces native controls that don't match the page style.

### Single shared "currently playing" reference scoped per render

`renderEntry` already runs once per lookup and rebinds handlers. We will keep a `let currentAudio` (and the button currently in the playing state) inside `renderEntry`'s closure. When the user clicks a play button: if there is a currently-playing audio, pause it and reset that button's state, then start the new one. This guarantees only one plays at a time on the current result without needing a module-level singleton. Alternative considered: a module-level audio singleton — unnecessary because a new lookup replaces `resultEl.innerHTML` and tears the old audio out anyway, but we should still defensively `pause()` any in-flight audio when re-rendering (handled via a `beforeunload`-style cleanup is overkill; we can just let GC + pause-on-new-click cover it).

### Playing state via `aria-pressed` + class toggle, mirroring existing toggle pattern

The existing "Show/Hide Chinese" button uses `aria-pressed` and a class. We'll do the same: `aria-pressed="true"` and add `audio--playing` while audio is active; flip back on `ended` or `error`. Symbol stays `▶` (and could become `⏸` while playing — minor visual cue we will include since it costs nothing). Alternative considered: a CSS animation — keeping it to a text glyph swap is simpler and matches the codebase style.

### Error handling: inline error slot inside the result, do not break the page

If `audio.play()` rejects (autoplay blocked, network error) or the `error` event fires, we will reset the button state and write a short message into a dedicated `#audio-error` element rendered inside the result. Rationale: the spec requires the rest of the result to remain intact, but the existing `showStatus("error", ...)` helper clears `resultEl.innerHTML` (it is the "before render" status panel), so reusing it would wipe definitions, examples, and the other pronunciation buttons — the opposite of what we want. A small inline `#audio-error` slot, cleared whenever a new playback starts successfully, gives a contained, retry-friendly surface. Alternatives considered: (a) `alert()` — too disruptive; (b) reusing `showStatus` — rejected for the reason above.

## Risks / Trade-offs

- **Mobile autoplay restrictions** → Playback is user-initiated (button click), which satisfies the gesture requirement on iOS/Android. Mitigation: invoke `audio.play()` directly inside the click handler synchronously, not after `await`.
- **CORS / mixed content on the Cambridge `.mp3`** → The URLs are HTTPS and Cambridge serves them publicly; the current `<a target="_blank">` approach already loads them in the browser context, so direct `Audio` playback should work the same. Mitigation: log and show an error if `play()` rejects; if this turns into a recurring failure, a follow-up change can proxy audio through the server.
- **Stale audio after re-render** → A user could click play, then submit a new search before audio ends. Mitigation: not strictly required (the old DOM is gone, GC takes the `Audio`), but we will still `pause()` the tracked audio when a click on another button supersedes it. Cross-render cleanup is out of scope.
- **Accessibility** → A `<button>` with `aria-label="Play pronunciation"` is more accessible than the prior link-with-glyph. Trade-off: slight markup churn, but a clear win.
