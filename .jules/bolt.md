## 2025-05-26 - [Performance Optimization] Removing DOM Query from Hot Path
**Learning:** Calling `document.querySelector("dialog[open]")` inside a `keydown` event listener is surprisingly expensive, introducing rendering latency since this intercepts every keystroke. Checking a property like `.open` on known dialog elements is significantly faster.
**Action:** When evaluating global keyboard handlers, avoid expensive DOM queries like `querySelector`. Instead, maintain references to elements and check properties, or manage focus/state variables.
