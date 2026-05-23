## Context

The search result view in `public/search.js` renders each Cambridge entry by emitting HTML into `#result`. Definition translations are emitted as `<p class="def__trans">…</p>` and example translations as `<div class="example__zh">…</div>`. Both elements are currently styled as visible text in `public/styles.css`. The page has no client-side framework — plain DOM + template strings.

Today, Chinese translations appear inline as soon as a word is looked up. That removes the chance to test recall from English alone, which is the practice mode the user wants.

## Goals / Non-Goals

**Goals:**
- Chinese translations are hidden in the rendered result by default.
- A single visible control on the result view toggles all Chinese translations in the current entry between hidden and shown.
- The toggle resets to "hidden" each time a new word is rendered.
- Implementation stays in the existing three files: `search.html`, `search.js`, `styles.css`. No new dependencies.

**Non-Goals:**
- Persisting the toggle state across page reloads or across different lookups (e.g., via `localStorage`).
- A per-row (per-definition / per-example) toggle. One control covers the whole entry.
- Server, API, or data-shape changes. The `/api/dictionary/:word` response continues to include translations.
- Touching the upload page or any other view.

## Decisions

### Hide via CSS class on the result container, not by omitting markup

Render the translation `<p>` / `<div>` elements as today, but gate their visibility with a CSS class (e.g., `result--hide-zh`) on `#result`. The toggle adds/removes that class. Translation elements get `display: none` when the class is present.

**Why over the alternative (conditional emission):** Conditional emission would require re-rendering the entry HTML on every toggle click, re-reading `entry` state, and re-attaching the toggle handler. A single class on the container is one DOM write per toggle and keeps the render path unchanged — `renderEntry` still produces the same HTML.

### Toggle is a button rendered next to the entry header

Place the toggle inside the result section (rendered by `renderEntry`), not in the topbar. It only makes sense once a result is on screen, and it should disappear when the result is hidden (e.g., on error). Putting it in the rendered output naturally ties its lifecycle to the result.

**Why a button (not a checkbox):** Matches the existing UI vocabulary (the page already uses `<button>` for actions, with `.secondary` styling available in `styles.css`).

### Default state is "hidden" on every render

`renderEntry` always emits `#result` with the `result--hide-zh` class applied, regardless of what state the toggle was in for the previous word. The button's text/aria-pressed reflects the current state.

**Why:** Matches the spec scenario "New lookup resets translation visibility" and avoids surprising the user with showing translations for a word they just searched fresh.

### Toggle handler attached after innerHTML write

`renderEntry` writes `resultEl.innerHTML = …` which replaces the button node on every render. The handler is attached by querying for the button immediately after the innerHTML write, in the same function. No event delegation needed — there's only one such button and it's always inside `#result`.

## Risks / Trade-offs

- **Risk:** A future contributor adds a new Chinese-bearing element (e.g., a synonym translation) and forgets to apply the hiding rule. → **Mitigation:** Use a single semantic class on the result container plus a small set of child selectors in CSS; document the convention in a one-line comment in `styles.css` next to the rule.
- **Trade-off:** Translations are still in the DOM, just hidden. A determined user could reveal them via devtools or "view source." → **Acceptable:** This is a study aid, not a security boundary; the goal is to nudge self-testing, not to prevent access.
