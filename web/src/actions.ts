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
