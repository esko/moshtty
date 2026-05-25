import { describe, expect, it } from "vitest";
import { getThemePalette, THEME_PRESETS } from "./themes";
import type { TerminalPalette, TerminalTheme } from "./types";

const requiredFields: Array<keyof TerminalPalette> = [
  "name", "kind", "background", "foreground", "cursor", "selectionBackground",
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
];

function validHex(str: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(str);
}

describe("theme preset gallery", () => {
  it("has all 8 preset themes", () => {
    expect(THEME_PRESETS.size).toBe(8);
  });

  const presetKeys = ["dark", "highContrast", "soft", "light", "solarizedLight", "catppuccinLatte", "tokyoNight", "dracula"];

  for (const key of presetKeys) {
    it(`preset "${key}" has all required fields with valid hex colors`, () => {
      const palette = THEME_PRESETS.get(key);
      expect(palette).toBeDefined();
      for (const field of requiredFields) {
        if (field === "name" || field === "kind") continue;
        expect(palette![field]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });
  }

  it("dark presets have kind 'dark'", () => {
    const darkNames = ["dark", "highContrast", "soft", "tokyoNight", "dracula"];
    for (const key of darkNames) {
      const palette = THEME_PRESETS.get(key);
      expect(palette).toBeDefined();
      expect(palette!.kind).toBe("dark");
    }
  });

  it("light presets have kind 'light'", () => {
    const lightNames = ["light", "solarizedLight", "catppuccinLatte"];
    for (const key of lightNames) {
      const palette = THEME_PRESETS.get(key);
      expect(palette).toBeDefined();
      expect(palette!.kind).toBe("light");
    }
  });
});

describe("getThemePalette", () => {
  it("returns a valid preset by default when theme is undefined", () => {
    const result = getThemePalette(undefined as unknown as TerminalTheme);
    expect(result.name).toBeDefined();
    expect(result.background).toBeDefined();
  });

  it("returns the dark preset for 'dark' key", () => {
    const result = getThemePalette({ preset: "dark" });
    expect(result.name).toBe("Dark");
    expect(result.background).toBe("#000000");
  });

  it("returns high contrast preset", () => {
    const result = getThemePalette({ preset: "highContrast" });
    expect(result.name).toBe("High Contrast");
    expect(result.foreground).toBe("#ffffff");
  });

  it("returns soft dark preset", () => {
    const result = getThemePalette({ preset: "soft" });
    expect(result.name).toBe("Soft Dark");
  });

  it("returns light preset", () => {
    const result = getThemePalette({ preset: "light" });
    expect(result.name).toBe("Light");
    expect(result.kind).toBe("light");
  });

  it("returns solarized light preset", () => {
    const result = getThemePalette({ preset: "solarizedLight" });
    expect(result.name).toBe("Solarized Light");
    expect(result.kind).toBe("light");
  });

  it("returns catppuccin latte preset", () => {
    const result = getThemePalette({ preset: "catppuccinLatte" });
    expect(result.name).toBe("Catppuccin Latte");
    expect(result.kind).toBe("light");
  });

  it("returns tokyo night preset", () => {
    const result = getThemePalette({ preset: "tokyoNight" });
    expect(result.name).toBe("Tokyo Night");
    expect(result.kind).toBe("dark");
  });

  it("returns dracula preset", () => {
    const result = getThemePalette({ preset: "dracula" });
    expect(result.name).toBe("Dracula");
    expect(result.kind).toBe("dark");
  });

  it("falls back to dark for unknown preset key", () => {
    const result = getThemePalette({ preset: "nonexistent" } as TerminalTheme);
    expect(result.name).toBe("Dark");
  });

  it("returns custom palette when preset is 'custom'", () => {
    const customPalette: TerminalPalette = {
      name: "My Custom",
      kind: "dark",
      background: "#123456",
      foreground: "#abcdef",
      cursor: "#fedcba",
      selectionBackground: "#333333",
      black: "#111111",
      red: "#222222",
      green: "#333333",
      yellow: "#444444",
      blue: "#555555",
      magenta: "#666666",
      cyan: "#777777",
      white: "#888888",
      brightBlack: "#999999",
      brightRed: "#aaaaaa",
      brightGreen: "#bbbbbb",
      brightYellow: "#cccccc",
      brightBlue: "#dddddd",
      brightMagenta: "#eeeeee",
      brightCyan: "#ffffff",
      brightWhite: "#000000",
    };
    const result = getThemePalette({ preset: "custom", palette: customPalette });
    expect(result.name).toBe("My Custom");
    expect(result.background).toBe("#123456");
    expect(result.foreground).toBe("#abcdef");
  });

  it("every preset has exactly 22 fields matching TerminalPalette", () => {
    for (const [key] of THEME_PRESETS) {
      const palette = THEME_PRESETS.get(key)!;
      const keys = Object.keys(palette).sort();
      expect(keys).toEqual([...requiredFields].sort());
    }
  });
});
