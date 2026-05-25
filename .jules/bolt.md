## 2024-10-24 - Remove Expensive DOM Queries on Keydown Hotpath
**Learning:** Checking for open dialogs using `document.querySelector("dialog[open]")` inside the `keydown` event listener is a performance bottleneck. The `keydown` listener runs for every keystroke, and deep DOM traversals or query selectors in this path add noticeable rendering latency in a terminal app.
**Action:** Always maintain references to the dialog elements (e.g. `renameDialog.open`) instead of dynamically querying the DOM inside hot paths like `keydown`, `pointermove`, or `requestAnimationFrame`.
