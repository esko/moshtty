import { describe, expect, it } from "vitest";
import { normalizeSettings, DEFAULT_SETTINGS } from "./settings";
import type { TerminalSettings } from "./types";

describe("normalizeSettings", () => {
  it("returns defaults for empty input", () => {
    const result = normalizeSettings({});
    expect(result.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(result.fontFamily).toBe(DEFAULT_SETTINGS.fontFamily);
    expect(result.accent).toBe("green");
    expect(result.density).toBe("comfortable");
    expect(result.cursorBlink).toBe(true);
    expect(result.cursorStyle).toBe("block");
    expect(result.scrollback).toBe(5000);
    expect(result.scrollSensitivity).toBe(1);
    expect(result.terminalPadding).toBe(0);
    expect(result.statusBarPosition).toBe("bottom");
    expect(result.statusBarShowClock).toBe(true);
    expect(result.statusBarShowPanes).toBe(true);
    expect(result.keybindings).toEqual({});
  });

  it("clamps fontSize to 12-22 range", () => {
    expect(normalizeSettings({ fontSize: 8 }).fontSize).toBe(12);
    expect(normalizeSettings({ fontSize: 30 }).fontSize).toBe(22);
    expect(normalizeSettings({ fontSize: 15 }).fontSize).toBe(15);
  });

  it("validation scrollback to allowed values", () => {
    expect(normalizeSettings({ scrollback: 5000 }).scrollback).toBe(5000);
    expect(normalizeSettings({ scrollback: 10000 }).scrollback).toBe(10000);
    expect(normalizeSettings({ scrollback: 999 }).scrollback).toBe(DEFAULT_SETTINGS.scrollback);
  });

  it("clamps scrollSensitivity to 0.5-2 range", () => {
    expect(normalizeSettings({ scrollSensitivity: 0.1 }).scrollSensitivity).toBe(0.5);
    expect(normalizeSettings({ scrollSensitivity: 3 }).scrollSensitivity).toBe(2);
    expect(normalizeSettings({ scrollSensitivity: 1.25 }).scrollSensitivity).toBe(1.25);
  });

  it("validates accent values", () => {
    expect(normalizeSettings({ accent: "blue" }).accent).toBe("blue");
    expect(normalizeSettings({ accent: "amber" }).accent).toBe("amber");
    expect(normalizeSettings({ accent: "green" }).accent).toBe("green");
    expect(normalizeSettings({ accent: "purple" }).accent).toBe("green");
  });

  it("validates density values", () => {
    expect(normalizeSettings({ density: "compact" }).density).toBe("compact");
    expect(normalizeSettings({ density: "comfortable" }).density).toBe("comfortable");
    expect(normalizeSettings({ density: "spacious" }).density).toBe("comfortable");
  });

  it("validates cursorStyle values", () => {
    expect(normalizeSettings({ cursorStyle: "underline" }).cursorStyle).toBe("underline");
    expect(normalizeSettings({ cursorStyle: "bar" }).cursorStyle).toBe("bar");
    expect(normalizeSettings({ cursorStyle: "block" }).cursorStyle).toBe("block");
    expect(normalizeSettings({ cursorStyle: "beam" }).cursorStyle).toBe("block");
  });

  it("clamps terminalPadding to 0-32", () => {
    expect(normalizeSettings({ terminalPadding: -5 }).terminalPadding).toBe(0);
    expect(normalizeSettings({ terminalPadding: 40 }).terminalPadding).toBe(32);
    expect(normalizeSettings({ terminalPadding: 8 }).terminalPadding).toBe(8);
  });

  it("validates statusBarPosition", () => {
    expect(normalizeSettings({ statusBarPosition: "hidden" }).statusBarPosition).toBe("hidden");
    expect(normalizeSettings({ statusBarPosition: "bottom" }).statusBarPosition).toBe("bottom");
    expect(normalizeSettings({ statusBarPosition: "top" }).statusBarPosition).toBe("bottom");
  });

  it("validates boolean fields", () => {
    expect(normalizeSettings({ cursorBlink: false }).cursorBlink).toBe(false);
    expect(normalizeSettings({ cursorBlink: true }).cursorBlink).toBe(true);
    expect(normalizeSettings({ statusBarShowClock: false }).statusBarShowClock).toBe(false);
    expect(normalizeSettings({ statusBarShowPanes: false }).statusBarShowPanes).toBe(false);
  });

  it("validates defaultProfileId format", () => {
    const valid = "profile-my-local-01";
    expect(normalizeSettings({ defaultProfileId: valid }).defaultProfileId).toBe(valid);
    expect(normalizeSettings({ defaultProfileId: "PROFILE" }).defaultProfileId).toBe(DEFAULT_SETTINGS.defaultProfileId);
    expect(normalizeSettings({ defaultProfileId: "ab" }).defaultProfileId).toBe(DEFAULT_SETTINGS.defaultProfileId);
  });

  it("normalizes theme preset from string", () => {
    const result = normalizeSettings({ theme: "soft" });
    expect(result.theme).toEqual({ preset: "soft" });
  });

  it("normalizes theme preset from object", () => {
    const result = normalizeSettings({ theme: { preset: "tokyoNight" } });
    expect(result.theme).toEqual({ preset: "tokyoNight" });
  });

  it("falls back to dark theme for unknown preset", () => {
    const result = normalizeSettings({ theme: "nonexistent" });
    expect(result.theme).toEqual({ preset: "dark" });
  });

  it("normalizes custom theme with all color fields", () => {
    const palette = {
      name: "Test",
      kind: "dark",
      background: "#111111",
      foreground: "#eeeeee",
      cursor: "#cccccc",
      selectionBackground: "#333333",
      black: "#000000",
      red: "#ff0000",
      green: "#00ff00",
      yellow: "#ffff00",
      blue: "#0000ff",
      magenta: "#ff00ff",
      cyan: "#00ffff",
      white: "#ffffff",
      brightBlack: "#555555",
      brightRed: "#ff5555",
      brightGreen: "#55ff55",
      brightYellow: "#ffff55",
      brightBlue: "#5555ff",
      brightMagenta: "#ff55ff",
      brightCyan: "#55ffff",
      brightWhite: "#ffffff",
    };
    const result = normalizeSettings({ theme: { preset: "custom", palette } });
    expect(result.theme).toEqual({ preset: "custom", palette });
  });

  it("normalizes keybindings to string dict", () => {
    const result = normalizeSettings({ keybindings: { "close-pane": "Ctrl+Shift+X", "invalid": 42 } });
    expect(result.keybindings).toEqual({ "close-pane": "Ctrl+Shift+X" });
  });

  it("normalizes customFontUrl to empty string for non-string input", () => {
    const result = normalizeSettings({ customFontUrl: 123 });
    expect(result.customFontUrl).toBe("");
  });

  it("trims strings in normalizeKeybindings", () => {
    const result = normalizeSettings({ keybindings: { "my-action": "  Ctrl+K Ctrl+C  " } });
    expect(result.keybindings["my-action"]).toBe("Ctrl+K Ctrl+C");
  });
});
