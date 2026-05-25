export type ActionId = string;

export type Action = {
  id: ActionId;
  label: string;        // Human-readable: "Split Right"
  category: "pane" | "tab" | "workspace" | "view" | "settings";
  defaultKeys?: string; // e.g., "Ctrl+Shift+Right"
  handler: () => void | Promise<void>;
  enabled?: () => boolean; // Whether the action is currently available
};

export type KeyChord = {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  key: string;
};

export const actionRegistry = new Map<ActionId, Action>();

export function registerAction(action: Action): void {
  actionRegistry.set(action.id, action);
}

export function getAction(id: ActionId): Action | undefined {
  return actionRegistry.get(id);
}

export function getAllActions(): Action[] {
  return Array.from(actionRegistry.values());
}

export function parseKeyChord(chord: string): KeyChord | null {
  const parts = chord.split("+");
  let ctrlKey = false;
  let shiftKey = false;
  let altKey = false;
  let metaKey = false;
  let key = "";
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part === "Ctrl") ctrlKey = true;
    else if (part === "Shift") shiftKey = true;
    else if (part === "Alt") altKey = true;
    else if (part === "Meta") metaKey = true;
    else if (part) {
      key = part;
    }
  }
  
  if (!key) return null;
  return { ctrlKey, shiftKey, altKey, metaKey, key };
}

export function matchKeyChord(event: KeyboardEvent, chord: string): boolean {
  const parsed = parseKeyChord(chord);
  if (!parsed) return false;
  
  if (!!event.ctrlKey !== parsed.ctrlKey) return false;
  if (!!event.shiftKey !== parsed.shiftKey) return false;
  if (!!event.altKey !== parsed.altKey) return false;
  if (!!event.metaKey !== parsed.metaKey) return false;
  
  const code = event.code || "";
  const eventKey = event.key || "";
  const targetKey = parsed.key;
  
  // Direct matches
  if (code.toLowerCase() === targetKey.toLowerCase()) return true;
  if (eventKey.toLowerCase() === targetKey.toLowerCase()) return true;
  
  // Normalized arrow keys
  if (targetKey.toLowerCase() === "right" && code === "ArrowRight") return true;
  if (targetKey.toLowerCase() === "left" && code === "ArrowLeft") return true;
  if (targetKey.toLowerCase() === "up" && code === "ArrowUp") return true;
  if (targetKey.toLowerCase() === "down" && code === "ArrowDown") return true;
  
  // KeyD / D matching
  if (targetKey.length === 1 && code === "Key" + targetKey.toUpperCase()) return true;
  if (targetKey.startsWith("Key") && targetKey.slice(3).toLowerCase() === eventKey.toLowerCase()) return true;
  
  // Digit1 / 1 matching
  if (targetKey.length === 1 && !isNaN(Number(targetKey)) && code === "Digit" + targetKey) return true;
  
  return false;
}

export function parseBindingSequence(binding: string): string[] {
  return binding.trim().split(/\s+/).filter(Boolean);
}

export function isMultiChordBinding(binding: string): boolean {
  return parseBindingSequence(binding).length > 1;
}

const SEQUENCE_TIMEOUT_MS = 2000;

type ActiveSequence = {
  actionId: string;
  chords: string[];
  currentIndex: number;
  timer: ReturnType<typeof setTimeout> | null;
};

let activeSequence: ActiveSequence | null = null;

export function startSequence(actionId: string, binding: string): void {
  cancelSequence();
  const chords = parseBindingSequence(binding);
  if (chords.length <= 1) return;
  activeSequence = {
    actionId,
    chords,
    currentIndex: 1,
    timer: setTimeout(() => cancelSequence(), SEQUENCE_TIMEOUT_MS),
  };
}

export type AdvanceResult =
  | { status: "continue"; progress: string }
  | { status: "complete"; actionId: string }
  | { status: "mismatch" };

export function advanceSequence(event: KeyboardEvent): AdvanceResult {
  if (!activeSequence) return { status: "mismatch" };

  const expectedChord = activeSequence.chords[activeSequence.currentIndex];
  if (!matchKeyChord(event, expectedChord)) {
    cancelSequence();
    return { status: "mismatch" };
  }

  if (activeSequence.timer) clearTimeout(activeSequence.timer);

  activeSequence.currentIndex++;

  if (activeSequence.currentIndex >= activeSequence.chords.length) {
    const actionId = activeSequence.actionId;
    cancelSequence();
    return { status: "complete", actionId };
  }

  activeSequence.timer = setTimeout(() => cancelSequence(), SEQUENCE_TIMEOUT_MS);
  return {
    status: "continue",
    progress: activeSequence.chords.slice(0, activeSequence.currentIndex).join(" "),
  };
}

export function cancelSequence(): void {
  if (!activeSequence) return;
  if (activeSequence.timer) clearTimeout(activeSequence.timer);
  activeSequence = null;
}

export function isSequenceActive(): boolean {
  return activeSequence !== null;
}

export function getSequenceProgress(): string {
  if (!activeSequence) return "";
  return activeSequence.chords.slice(0, activeSequence.currentIndex).join(" ");
}

export function eventToChordString(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  
  const code = event.code || "";
  let keyPart = code;
  
  if (code.startsWith("Key") && code.length === 4) {
    keyPart = code.slice(3); // e.g. "KeyD" -> "D"
  } else if (code.startsWith("Digit") && code.length === 6) {
    keyPart = code.slice(5); // e.g. "Digit1" -> "1"
  } else if (code === "ArrowRight") {
    keyPart = "Right";
  } else if (code === "ArrowLeft") {
    keyPart = "Left";
  } else if (code === "ArrowUp") {
    keyPart = "Up";
  } else if (code === "ArrowDown") {
    keyPart = "Down";
  } else if (!code && event.key) {
    keyPart = event.key;
  }
  
  parts.push(keyPart);
  return parts.join("+");
}
