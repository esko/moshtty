import { clamp } from "./dom";
import type { TerminalSettings } from "./types";

export const SETTINGS_KEY = "crostini-ghostty-terminal-settings";

export const DEFAULT_SETTINGS: TerminalSettings = {
  fontFamily: "JetBrains Mono, Noto Sans Mono, monospace",
  customFontName: "",
  customFontUrl: "",
  fontSize: 15,
  scrollback: 5000,
  cursorBlink: true,
  theme: "dark",
  scrollSensitivity: 1,
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
  const theme = value.theme === "highContrast" || value.theme === "soft" ? value.theme : "dark";
  return {
    fontFamily: normalizeText(value.fontFamily, DEFAULT_SETTINGS.fontFamily, 160),
    customFontName: normalizeText(value.customFontName, DEFAULT_SETTINGS.customFontName, 80),
    customFontUrl: normalizeFontUrl(value.customFontUrl),
    fontSize: Number.isFinite(fontSize) ? clamp(Math.round(fontSize), 12, 22) : DEFAULT_SETTINGS.fontSize,
    scrollback: [1000, 5000, 10000, 20000].includes(scrollback) ? scrollback : DEFAULT_SETTINGS.scrollback,
    cursorBlink: typeof value.cursorBlink === "boolean" ? value.cursorBlink : DEFAULT_SETTINGS.cursorBlink,
    theme,
    scrollSensitivity: Number.isFinite(scrollSensitivity) ? clamp(scrollSensitivity, 0.5, 2) : DEFAULT_SETTINGS.scrollSensitivity,
  };
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== "string") return fallback;
  const nextValue = value.trim();
  return nextValue ? nextValue.slice(0, maxLength) : fallback;
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

export function terminalTheme(theme: TerminalSettings["theme"]) {
  if (theme === "highContrast") {
    return {
      background: "#000000",
      foreground: "#ffffff",
      cursor: "#ffffff",
      selectionBackground: "#345f9f",
      black: "#000000",
      red: "#ff5c57",
      green: "#5af78e",
      yellow: "#f3f99d",
      blue: "#57c7ff",
      magenta: "#ff6ac1",
      cyan: "#9aedfe",
      white: "#f1f1f0",
      brightBlack: "#686868",
      brightRed: "#ff5c57",
      brightGreen: "#5af78e",
      brightYellow: "#f3f99d",
      brightBlue: "#57c7ff",
      brightMagenta: "#ff6ac1",
      brightCyan: "#9aedfe",
      brightWhite: "#ffffff",
    };
  }
  if (theme === "soft") {
    return {
      background: "#080d12",
      foreground: "#d8dee9",
      cursor: "#e5edf5",
      selectionBackground: "#334b5f",
      black: "#1b2632",
      red: "#e06c75",
      green: "#98c379",
      yellow: "#d19a66",
      blue: "#61afef",
      magenta: "#c678dd",
      cyan: "#56b6c2",
      white: "#d8dee9",
      brightBlack: "#607080",
      brightRed: "#ef7b84",
      brightGreen: "#a7d388",
      brightYellow: "#e0aa75",
      brightBlue: "#70befd",
      brightMagenta: "#d587ec",
      brightCyan: "#65c5d1",
      brightWhite: "#eef4fb",
    };
  }
  return {
    background: "#000000",
    foreground: "#d7e0ea",
    cursor: "#d7e0ea",
    selectionBackground: "#2f5f91",
    black: "#101820",
    red: "#ff6b7a",
    green: "#7bd88f",
    yellow: "#f7c76b",
    blue: "#6ccff6",
    magenta: "#c792ea",
    cyan: "#5de4c7",
    white: "#d7e0ea",
    brightBlack: "#52677a",
    brightRed: "#ff8fa0",
    brightGreen: "#a5f3b1",
    brightYellow: "#ffe08a",
    brightBlue: "#9adfff",
    brightMagenta: "#d6a9ff",
    brightCyan: "#8df2dc",
    brightWhite: "#f0f4f8",
  };
}
