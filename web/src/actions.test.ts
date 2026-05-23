import { describe, expect, it } from "vitest";
import { registerAction, getAction, getAllActions, actionRegistry } from "./actions";

function stubAction(overrides: Partial<Parameters<typeof registerAction>[0]> = {}) {
  return {
    id: "test-action",
    label: "Test Action",
    category: "view" as const,
    handler: () => {},
    ...overrides,
  };
}

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
