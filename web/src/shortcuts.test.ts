import { describe, expect, it } from "vitest";
import { paneShortcutForEvent, shouldPassThroughSystemShortcut } from "./shortcuts";

function keyEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
  return init as KeyboardEvent;
}

describe("system shortcut passthrough", () => {
  it("lets ChromeOS launcher shortcuts pass through", () => {
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyL", metaKey: true }))).toBe(true);
  });

  it("lets browser/PWA shortcuts pass through", () => {
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyR", ctrlKey: true }))).toBe(true);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "Tab", ctrlKey: true }))).toBe(true);
  });

  it("lets native tab shortcuts pass through", () => {
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyT", ctrlKey: true }))).toBe(true);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyW", ctrlKey: true }))).toBe(true);
  });

  it("keeps common terminal control keys in the terminal", () => {
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyC", ctrlKey: true }))).toBe(false);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyD", ctrlKey: true }))).toBe(false);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyL", ctrlKey: true }))).toBe(false);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyZ", ctrlKey: true }))).toBe(false);
  });

  it("lets top-row system keys pass through", () => {
    expect(shouldPassThroughSystemShortcut(keyEvent({ key: "AudioVolumeUp" }))).toBe(true);
    expect(shouldPassThroughSystemShortcut(keyEvent({ key: "BrightnessDown" }))).toBe(true);
  });
});

describe("pane shortcut classification", () => {
  it("maps Ctrl+Shift pane layout shortcuts", () => {
    expect(paneShortcutForEvent(keyEvent({ code: "ArrowRight", ctrlKey: true, shiftKey: true }))).toBe("split-right");
    expect(paneShortcutForEvent(keyEvent({ code: "ArrowDown", ctrlKey: true, shiftKey: true }))).toBe("split-down");
    expect(paneShortcutForEvent(keyEvent({ code: "ArrowLeft", ctrlKey: true, shiftKey: true }))).toBe("focus-previous");
    expect(paneShortcutForEvent(keyEvent({ code: "ArrowUp", ctrlKey: true, shiftKey: true }))).toBe("focus-next");
    expect(paneShortcutForEvent(keyEvent({ code: "Backspace", ctrlKey: true, shiftKey: true }))).toBe("close-pane");
    expect(paneShortcutForEvent(keyEvent({ code: "KeyD", ctrlKey: true, shiftKey: true }))).toBe("detach-pane");
  });

  it("does not classify shell basics or browser shortcuts as pane shortcuts", () => {
    expect(paneShortcutForEvent(keyEvent({ code: "KeyC", ctrlKey: true }))).toBeUndefined();
    expect(paneShortcutForEvent(keyEvent({ code: "KeyD", ctrlKey: true }))).toBeUndefined();
    expect(paneShortcutForEvent(keyEvent({ code: "KeyZ", ctrlKey: true }))).toBeUndefined();
    expect(paneShortcutForEvent(keyEvent({ code: "KeyL", ctrlKey: true }))).toBeUndefined();
    expect(paneShortcutForEvent(keyEvent({ code: "KeyT", ctrlKey: true }))).toBeUndefined();
    expect(paneShortcutForEvent(keyEvent({ code: "KeyW", ctrlKey: true }))).toBeUndefined();
  });

  it("requires exactly Ctrl+Shift without platform or Alt modifiers", () => {
    expect(paneShortcutForEvent(keyEvent({ code: "ArrowRight", ctrlKey: true }))).toBeUndefined();
    expect(paneShortcutForEvent(keyEvent({ code: "ArrowRight", shiftKey: true }))).toBeUndefined();
    expect(paneShortcutForEvent(keyEvent({ code: "ArrowRight", ctrlKey: true, shiftKey: true, altKey: true }))).toBeUndefined();
    expect(paneShortcutForEvent(keyEvent({ code: "ArrowRight", ctrlKey: true, shiftKey: true, metaKey: true }))).toBeUndefined();
  });
});
