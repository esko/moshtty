## 2025-02-28 - Layout Thrashing in Split Pane Resizing
**Learning:** The custom pane splitter was querying `getBoundingClientRect()` on every `pointermove` event while concurrently mutating flex layouts. This caused layout thrashing, severely degrading resize performance.
**Action:** When implementing custom drag/resize interactions, cache the bounding client rect of the container on `pointerdown` and use the cached value during `pointermove` to avoid forced synchronous layout recalculations.
