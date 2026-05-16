import { describe, expect, it } from "vitest";
import { shouldPassThroughSystemShortcut } from "./shortcuts";

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

  it("keeps common terminal control keys in the terminal", () => {
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyC", ctrlKey: true }))).toBe(false);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyD", ctrlKey: true }))).toBe(false);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyL", ctrlKey: true }))).toBe(false);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyT", ctrlKey: true }))).toBe(false);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyW", ctrlKey: true }))).toBe(false);
    expect(shouldPassThroughSystemShortcut(keyEvent({ code: "KeyZ", ctrlKey: true }))).toBe(false);
  });

  it("lets top-row system keys pass through", () => {
    expect(shouldPassThroughSystemShortcut(keyEvent({ key: "AudioVolumeUp" }))).toBe(true);
    expect(shouldPassThroughSystemShortcut(keyEvent({ key: "BrightnessDown" }))).toBe(true);
  });
});
