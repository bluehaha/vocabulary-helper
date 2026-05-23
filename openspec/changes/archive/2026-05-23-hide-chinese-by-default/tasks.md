## 1. CSS: hide-translations rule

- [x] 1.1 In `public/styles.css`, add a rule that, when `#result` carries the class `result--hide-zh`, sets `display: none` on its descendant `.def__trans` and `.example__zh` elements.
- [x] 1.2 Add a one-line comment next to the rule noting that any new Chinese-bearing class should be added to this selector.

## 2. Render: hidden by default + toggle button

- [x] 2.1 In `public/search.js`, update `renderEntry` to add the `result--hide-zh` class to `resultEl` on every render (regardless of prior state).
- [x] 2.2 In `renderEntry`, emit a single toggle button inside the rendered HTML (e.g., next to the entry header). Initial label: "Show Chinese". Give it a stable id or class for selection (e.g., `id="toggle-zh"`).
- [x] 2.3 After the `resultEl.innerHTML = …` assignment in `renderEntry`, query the toggle button and attach a click handler that toggles the `result--hide-zh` class on `resultEl` and updates the button's label between "Show Chinese" and "Hide Chinese" to reflect the new state. Also update `aria-pressed` for accessibility.

## 3. Styling polish

- [x] 3.1 Style the toggle button using the existing `.secondary` button styling so it does not compete visually with the primary "Look up" action. Place it so it is clearly associated with the result (e.g., right-aligned in the entry header or just above the definitions).

## 4. Verify against spec scenarios

- [x] 4.1 Start the server and look up a word that has Chinese translations (e.g., one already in `data/`). Confirm definition translations (`.def__trans`) and example translations (`.example__zh`) are not visible on initial render.
- [x] 4.2 Click the toggle. Confirm every translation in the entry becomes visible and the button label flips to "Hide Chinese".
- [x] 4.3 Click the toggle again. Confirm every translation hides again and the label flips back to "Show Chinese".
- [x] 4.4 With Chinese revealed, look up a different word. Confirm the new entry renders with Chinese hidden again and the button reads "Show Chinese".
- [x] 4.5 Trigger an error or not-found path (search a nonsense word). Confirm the result section is hidden, so the toggle button is not visible alongside an error.
