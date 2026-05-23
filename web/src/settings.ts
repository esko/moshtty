import { clamp } from "./dom";
import type { TerminalSettings, TerminalTheme, TerminalPalette } from "./types";
import { getThemePalette, THEME_PRESETS } from "./themes";

export const SETTINGS_KEY = "crostini-ghostty-terminal-settings";

export const DEFAULT_SETTINGS: TerminalSettings = {
  fontFamily: "JetBrains Mono, Noto Sans Mono, monospace",
  customFontName: "",
  customFontUrl: "",
  fontSize: 15,
  scrollback: 5000,
  cursorBlink: true,
  accent: "green",
  density: "comfortable",
  theme: { preset: "dark" },
  cursorStyle: "block",
  terminalPadding: 0,
  scrollSensitivity: 1,
  defaultProfileId: "profile-default",
  keybindings: {},
  statusBarShowClock: true,
  statusBarShowPanes: true,
  statusBarPosition: "bottom",
};

export function loadSettings(): TerminalSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(nextSettings: TerminalSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
}

export function applyAppAppearance(nextSettings: TerminalSettings): void {
  document.documentElement.dataset.accent = nextSettings.accent;
  document.documentElement.dataset.density = nextSettings.density;
  document.documentElement.style.setProperty("--terminal-padding", `${nextSettings.terminalPadding}px`);
}

export async function loadCustomFont(nextSettings: TerminalSettings): Promise<void> {
  const fontUrl = nextSettings.customFontUrl;
  if (!fontUrl) return;
  const fontName = customFontName(nextSettings);
  const style = document.createElement("style");
  style.id = "customTerminalFont";
  style.textContent = `
@font-face {
  font-family: "${cssString(fontName)}";
  font-style: normal;
  font-weight: 400;
  font-display: block;
  src: url("${cssUrl(fontUrl)}") format("${fontFormat(fontUrl)}");
}`;
  document.head.append(style);
  if ("fonts" in document) {
    try {
      await document.fonts.load(`400 ${nextSettings.fontSize}px "${fontName}"`);
      await document.fonts.ready;
    } catch (error) {
      console.warn("custom font load failed", error);
    }
  }
}

export function terminalFontFamily(nextSettings: TerminalSettings): string {
  if (!nextSettings.customFontUrl) return nextSettings.fontFamily;
  return `"${customFontName(nextSettings)}", ${nextSettings.fontFamily}`;
}

export function customFontName(nextSettings: TerminalSettings): string {
  return nextSettings.customFontName || "Custom Terminal Font";
}

export function normalizeSettings(value: Partial<TerminalSettings> | Record<string, unknown>): TerminalSettings {
  const fontSize = Number(value.fontSize);
  const scrollback = Number(value.scrollback);
  const scrollSensitivity = Number(value.scrollSensitivity);
  const accent = value.accent === "blue" || value.accent === "amber" ? value.accent : "green";
  const density = value.density === "compact" ? value.density : "comfortable";

  let theme: TerminalTheme = { preset: "dark" };
  if (value.theme && typeof value.theme === "object") {
    const valTheme = value.theme as any;
    if (valTheme.preset === "custom" && valTheme.palette && typeof valTheme.palette === "object") {
      const pal = valTheme.palette;
      theme = {
        preset: "custom",
        palette: {
          name: normalizeText(pal.name, "Custom", 40),
          kind: pal.kind === "light" ? "light" : "dark",
          background: normalizeHexColor(pal.background, "#000000"),
          foreground: normalizeHexColor(pal.foreground, "#d7e0ea"),
          cursor: normalizeHexColor(pal.cursor, "#d7e0ea"),
          selectionBackground: normalizeHexColor(pal.selectionBackground, "#2f5f91"),
          black: normalizeHexColor(pal.black, "#101820"),
          red: normalizeHexColor(pal.red, "#ff6b7a"),
          green: normalizeHexColor(pal.green, "#7bd88f"),
          yellow: normalizeHexColor(pal.yellow, "#f7c76b"),
          blue: normalizeHexColor(pal.blue, "#6ccff6"),
          magenta: normalizeHexColor(pal.magenta, "#c792ea"),
          cyan: normalizeHexColor(pal.cyan, "#5de4c7"),
          white: normalizeHexColor(pal.white, "#d7e0ea"),
          brightBlack: normalizeHexColor(pal.brightBlack, "#52677a"),
          brightRed: normalizeHexColor(pal.brightRed, "#ff8fa0"),
          brightGreen: normalizeHexColor(pal.brightGreen, "#a5f3b1"),
          brightYellow: normalizeHexColor(pal.brightYellow, "#ffe08a"),
          brightBlue: normalizeHexColor(pal.brightBlue, "#9adfff"),
          brightMagenta: normalizeHexColor(pal.brightMagenta, "#d6a9ff"),
          brightCyan: normalizeHexColor(pal.brightCyan, "#8df2dc"),
          brightWhite: normalizeHexColor(pal.brightWhite, "#f0f4f8"),
        },
      };
    } else if (typeof valTheme.preset === "string" && THEME_PRESETS.has(valTheme.preset)) {
      theme = { preset: valTheme.preset };
    }
  } else if (typeof value.theme === "string" && THEME_PRESETS.has(value.theme)) {
    theme = { preset: value.theme };
  }

  const cursorStyle = value.cursorStyle === "underline" || value.cursorStyle === "bar" ? value.cursorStyle : "block";
  const terminalPadding = Number(value.terminalPadding);

  const keybindings = normalizeKeybindings(value.keybindings);
  const statusBarShowClock = typeof value.statusBarShowClock === "boolean" ? value.statusBarShowClock : DEFAULT_SETTINGS.statusBarShowClock;
  const statusBarShowPanes = typeof value.statusBarShowPanes === "boolean" ? value.statusBarShowPanes : DEFAULT_SETTINGS.statusBarShowPanes;
  const statusBarPosition = value.statusBarPosition === "hidden" ? "hidden" : "bottom";

  const defaultProfileId =
    typeof value.defaultProfileId === "string" && /^[a-z0-9][a-z0-9-]{2,63}$/.test(value.defaultProfileId)
      ? value.defaultProfileId
      : DEFAULT_SETTINGS.defaultProfileId;
  return {
    fontFamily: normalizeText(value.fontFamily, DEFAULT_SETTINGS.fontFamily, 160),
    customFontName: normalizeText(value.customFontName, DEFAULT_SETTINGS.customFontName, 80),
    customFontUrl: normalizeFontUrl(value.customFontUrl),
    fontSize: Number.isFinite(fontSize) ? clamp(Math.round(fontSize), 12, 22) : DEFAULT_SETTINGS.fontSize,
    scrollback: [1000, 5000, 10000, 20000].includes(scrollback) ? scrollback : DEFAULT_SETTINGS.scrollback,
    cursorBlink: typeof value.cursorBlink === "boolean" ? value.cursorBlink : DEFAULT_SETTINGS.cursorBlink,
    accent,
    density,
    theme,
    cursorStyle,
    terminalPadding: Number.isFinite(terminalPadding) ? clamp(Math.round(terminalPadding), 0, 32) : DEFAULT_SETTINGS.terminalPadding,
    scrollSensitivity: Number.isFinite(scrollSensitivity) ? clamp(scrollSensitivity, 0.5, 2) : DEFAULT_SETTINGS.scrollSensitivity,
    defaultProfileId,
    keybindings,
    statusBarShowClock,
    statusBarShowPanes,
    statusBarPosition,
  };
}

function normalizeKeybindings(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [actionId, chord] of Object.entries(record)) {
      if (typeof chord === "string" && typeof actionId === "string") {
        result[actionId] = chord.trim();
      }
    }
  }
  return result;
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const nextValue = value.trim();
  return nextValue ? nextValue.slice(0, maxLength) : fallback;
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim();
  if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{4}$|^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{8}$/.test(cleaned)) {
    return cleaned;
  }
  return fallback;
}

function normalizeFontUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const nextValue = value.trim();
  if (!nextValue) return "";
  try {
    const url = new URL(nextValue, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.pathname.startsWith("/") && url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : url.toString();
  } catch {
    return "";
  }
}

function cssString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function cssUrl(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "");
}

function fontFormat(url: string): string {
  const path = new URL(url, window.location.href).pathname.toLowerCase();
  if (path.endsWith(".woff2")) return "woff2";
  if (path.endsWith(".woff")) return "woff";
  if (path.endsWith(".otf")) return "opentype";
  return "truetype";
}
