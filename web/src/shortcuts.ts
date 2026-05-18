const CTRL_BROWSER_CODES = new Set([
  "Digit0",
  "Equal",
  "Minus",
  "BracketLeft",
  "BracketRight",
  "KeyN",
  "KeyR",
  "KeyT",
  "KeyW",
  "PageDown",
  "PageUp",
  "Tab",
]);

const CHROMEOS_SYSTEM_KEYS = new Set([
  "AudioVolumeDown",
  "AudioVolumeMute",
  "AudioVolumeUp",
  "BrowserBack",
  "BrowserForward",
  "BrowserRefresh",
  "BrightnessDown",
  "BrightnessUp",
  "LaunchApplication1",
  "LaunchApplication2",
  "MediaPlayPause",
  "MediaTrackNext",
  "MediaTrackPrevious",
  "Power",
  "PrintScreen",
  "ZoomToggle",
]);

export type PaneShortcut =
  | "split-right"
  | "split-down"
  | "focus-previous"
  | "focus-next"
  | "close-pane"
  | "detach-pane";

export function shouldPassThroughSystemShortcut(event: KeyboardEvent): boolean {
  if (CHROMEOS_SYSTEM_KEYS.has(event.key) || CHROMEOS_SYSTEM_KEYS.has(event.code)) {
    return true;
  }

  // ChromeOS Launcher/Search and platform shortcuts should stay with the OS.
  if (event.metaKey) {
    return true;
  }

  // Browser/PWA navigation and window management.
  if (event.altKey && !event.ctrlKey) {
    return event.code === "ArrowLeft" || event.code === "ArrowRight" || event.code === "Tab";
  }

  if (!event.ctrlKey) {
    return false;
  }

  if (event.altKey) {
    return true;
  }

  return CTRL_BROWSER_CODES.has(event.code);
}

export function paneShortcutForEvent(event: KeyboardEvent): PaneShortcut | undefined {
  if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey) {
    return undefined;
  }

  switch (event.code) {
    case "ArrowRight":
      return "split-right";
    case "ArrowDown":
      return "split-down";
    case "ArrowLeft":
      return "focus-previous";
    case "ArrowUp":
      return "focus-next";
    case "Backspace":
      return "close-pane";
    case "KeyD":
      return "detach-pane";
    default:
      return undefined;
  }
}
