import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { registerAction, getAction, getAllActions, actionRegistry, parseBindingSequence, isMultiChordBinding, startSequence, advanceSequence, cancelSequence, isSequenceActive, getSequenceProgress } from "./actions";

function stubAction(overrides: Partial<Parameters<typeof registerAction>[0]> = {}) {
  return {
    id: "test-action",
    label: "Test Action",
    category: "view" as const,
    handler: () => {},
    ...overrides,
  };
}

function kev(ctrlKey: boolean, shiftKey: boolean, altKey: boolean, metaKey: boolean, key: string, code: string): KeyboardEvent {
  return { ctrlKey, shiftKey, altKey, metaKey, key, code } as KeyboardEvent;
}

describe("parseBindingSequence", () => {
  it("splits a single chord binding", () => {
    const result = parseBindingSequence("Ctrl+Shift+D");
    expect(result).toEqual(["Ctrl+Shift+D"]);
  });

  it("splits a multi-chord binding", () => {
    const result = parseBindingSequence("Ctrl+K Ctrl+C");
    expect(result).toEqual(["Ctrl+K", "Ctrl+C"]);
  });

  it("splits three chords", () => {
    const result = parseBindingSequence("Ctrl+A Ctrl+B Ctrl+C");
    expect(result).toEqual(["Ctrl+A", "Ctrl+B", "Ctrl+C"]);
  });

  it("handles extra whitespace", () => {
    const result = parseBindingSequence("  Ctrl+K    Ctrl+C  ");
    expect(result).toEqual(["Ctrl+K", "Ctrl+C"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseBindingSequence("")).toEqual([]);
    expect(parseBindingSequence("   ")).toEqual([]);
  });
});

describe("isMultiChordBinding", () => {
  it("returns false for single chord", () => {
    expect(isMultiChordBinding("Ctrl+Shift+D")).toBe(false);
  });

  it("returns true for multi-chord", () => {
    expect(isMultiChordBinding("Ctrl+K Ctrl+C")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isMultiChordBinding("")).toBe(false);
  });
});

describe("sequence state machine", () => {
  const ctrlC = kev(true, false, false, false, "c", "KeyC");
  const ctrlD = kev(true, false, false, false, "d", "KeyD");

  beforeEach(() => {
    cancelSequence();
  });

  afterEach(() => {
    cancelSequence();
  });

  it("starts a sequence", () => {
    startSequence("close-pane", "Ctrl+K Ctrl+C");
    expect(isSequenceActive()).toBe(true);
  });

  it("does not start a sequence for single-chord binding", () => {
    startSequence("close-pane", "Ctrl+Shift+D");
    expect(isSequenceActive()).toBe(false);
  });

  it("advances a sequence to continue", () => {
    startSequence("close-pane", "Ctrl+K Ctrl+C");
    const result = advanceSequence(ctrlC);
    expect(result.status).toBe("complete");
    expect("actionId" in result && result.actionId).toBe("close-pane");
    expect(isSequenceActive()).toBe(false);
  });

  it("advances and completes a two-chord sequence", () => {
    startSequence("split-right", "Ctrl+K Ctrl+C");
    const result = advanceSequence(ctrlC);
    expect(result.status).toBe("complete");
    if (result.status === "complete") {
      expect(result.actionId).toBe("split-right");
    }
    expect(isSequenceActive()).toBe(false);
  });

  it("advances three-chord sequence with continue then complete", () => {
    const ctrlB = kev(true, false, false, false, "b", "KeyB");
    startSequence("copy", "Ctrl+K Ctrl+B Ctrl+C");
    const first = advanceSequence(ctrlB);
    expect(first.status).toBe("continue");
    if (first.status === "continue") {
      expect(first.progress).toBe("Ctrl+K Ctrl+B");
    }
    expect(isSequenceActive()).toBe(true);
    const second = advanceSequence(ctrlC);
    expect(second.status).toBe("complete");
    if (second.status === "complete") {
      expect(second.actionId).toBe("copy");
    }
    expect(isSequenceActive()).toBe(false);
  });

  it("returns mismatch for wrong chord", () => {
    startSequence("close-pane", "Ctrl+K Ctrl+C");
    const result = advanceSequence(ctrlD);
    expect(result.status).toBe("mismatch");
    expect(isSequenceActive()).toBe(false);
  });

  it("returns mismatch when no sequence is active", () => {
    const result = advanceSequence(ctrlC);
    expect(result.status).toBe("mismatch");
  });

  it("getSequenceProgress returns pressed chords", () => {
    startSequence("close-pane", "Ctrl+K Ctrl+C");
    expect(getSequenceProgress()).toBe("Ctrl+K");
  });

  it("cancelSequence clears the active sequence", () => {
    startSequence("close-pane", "Ctrl+K Ctrl+C");
    cancelSequence();
    expect(isSequenceActive()).toBe(false);
  });

  it("timeout cancels the sequence", () => {
    vi.useFakeTimers();
    startSequence("close-pane", "Ctrl+K Ctrl+C");
    expect(isSequenceActive()).toBe(true);
    vi.runAllTimers();
    expect(isSequenceActive()).toBe(false);
    vi.useRealTimers();
  });
});
describe("action registry", () => {
  it("registers and retrieves an action", () => {
    registerAction(stubAction());
    const action = getAction("test-action");
    expect(action).toBeDefined();
    expect(action!.id).toBe("test-action");
    expect(action!.label).toBe("Test Action");
    expect(action!.category).toBe("view");
  });

  it("returns undefined for unknown action id", () => {
    expect(getAction("nonexistent")).toBeUndefined();
  });

  it("returns all registered actions", () => {
    actionRegistry.clear();
    registerAction(stubAction({ id: "a1", label: "First" }));
    registerAction(stubAction({ id: "a2", label: "Second", category: "pane" }));
    const all = getAllActions();
    expect(all).toHaveLength(2);
    expect(all.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("overwrites existing action with same id", () => {
    actionRegistry.clear();
    registerAction(stubAction({ id: "dup", label: "Original" }));
    registerAction(stubAction({ id: "dup", label: "Updated", category: "tab" }));
    const action = getAction("dup");
    expect(action!.label).toBe("Updated");
    expect(action!.category).toBe("tab");
    expect(getAllActions()).toHaveLength(1);
  });

  it("stores enabled as optional function", () => {
    actionRegistry.clear();
    registerAction(stubAction({ id: "conditional", enabled: () => false }));
    const action = getAction("conditional");
    expect(action!.enabled).toBeDefined();
    expect(action!.enabled!()).toBe(false);
  });

  it("handles defaultKeys being optional", () => {
    actionRegistry.clear();
    registerAction(stubAction({ id: "no-keys" }));
    const action = getAction("no-keys");
    expect(action!.defaultKeys).toBeUndefined();
  });

  it("stores category for all valid values", () => {
    actionRegistry.clear();
    const categories = ["pane", "tab", "workspace", "view", "settings"] as const;
    for (const cat of categories) {
      registerAction(stubAction({ id: cat, category: cat }));
      expect(getAction(cat)!.category).toBe(cat);
    }
  });
});
