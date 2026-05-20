## 2025-02-28 - Cache bounding rect in pointermove handlers
**Learning:** Calling `getBoundingClientRect()` inside a rapid event listener like `pointermove` forces a synchronous layout calculation (layout thrashing) on every frame, which can significantly degrade the responsiveness of drag interactions.
**Action:** Always cache the initial `DOMRect` during `pointerdown` and reuse it during `pointermove` when elements are not expected to move or resize except by the drag itself.
