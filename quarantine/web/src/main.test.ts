import { describe, expect, it } from "vitest";
import { ptyURL } from "./api";
import { clamp, pathBaseName } from "./dom";
import { layoutLeaves, ratioFromKeyboard, ratioFromPointer, splitRatio } from "./layout";
import { normalizeSettings } from "./settings";

describe("ghostty-web websocket URL", () => {
  it("uses ws for http origins", () => {
    expect(ptyURL("abc", "term-123", true, 100, 30, "http://127.0.0.1:8765/")).toBe(
      "ws://127.0.0.1:8765/pty?token=abc&session=term-123&restore=1&cols=100&rows=30",
    );
  });
});

describe("settings normalization", () => {
  it("clamps numeric settings and rejects unsupported theme values", () => {
    const settings = normalizeSettings({
      fontSize: 99,
      scrollback: 123,
      scrollSensitivity: 0.1,
      cursorBlink: false,
      accent: "purple",
      density: "tiny",
      theme: "unknown",
      defaultProfileId: "../bad",
    });
    expect(settings.fontSize).toBe(22);
    expect(settings.scrollback).toBe(5000);
    expect(settings.scrollSensitivity).toBe(0.5);
    expect(settings.cursorBlink).toBe(false);
    expect(settings.accent).toBe("green");
    expect(settings.density).toBe("comfortable");
    expect(settings.theme).toEqual({ preset: "system" });
    expect(settings.defaultProfileId).toBe("profile-default");
  });
});

describe("dom utilities", () => {
  it("keeps small pure helpers predictable", () => {
    expect(clamp(10, 1, 5)).toBe(5);
    expect(pathBaseName("/bin/fish")).toBe("fish");
  });
});

describe("layout utilities", () => {
  it("traverses layout leaves in display order", () => {
    expect(
      layoutLeaves({
        type: "split",
        direction: "horizontal",
        ratio: 0.5,
        first: { type: "leaf", sessionId: "term-a" },
        second: { type: "leaf", sessionId: "term-b" },
      }),
    ).toEqual(["term-a", "term-b"]);
  });

  it("clamps split ratios", () => {
    expect(splitRatio(0.05)).toBe(0.2);
    expect(splitRatio(0.95)).toBe(0.8);
    expect(splitRatio(0.6)).toBe(0.6);
  });

  it("calculates horizontal and vertical pointer ratios", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 } as DOMRect;
    expect(ratioFromPointer("horizontal", rect, 110, 20)).toBe(0.5);
    expect(ratioFromPointer("vertical", rect, 10, 95)).toBe(0.75);
  });

  it("calculates keyboard split ratios", () => {
    expect(ratioFromKeyboard(0.5, "ArrowLeft")).toBe(0.45);
    expect(ratioFromKeyboard(0.5, "ArrowRight", true)).toBe(0.6);
    expect(ratioFromKeyboard(0.5, "Home")).toBe(0.2);
    expect(ratioFromKeyboard(0.5, "End")).toBe(0.8);
    expect(ratioFromKeyboard(0.5, "Escape")).toBeUndefined();
    expect(ratioFromKeyboard(0.21, "ArrowLeft")).toBe(0.2);
    expect(ratioFromKeyboard(0.79, "ArrowRight")).toBe(0.8);
  });
});
