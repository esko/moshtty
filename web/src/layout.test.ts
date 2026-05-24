import { describe, expect, it } from "vitest";
import { splitRatio, firstLeaf, layoutLeaves, ratioFromKeyboard, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO } from "./layout";
import type { SessionLayoutNode } from "./types";

const leaf = (id: string): SessionLayoutNode => ({ type: "leaf", sessionId: id });
const split = (first: SessionLayoutNode, second: SessionLayoutNode, ratio = 0.5): SessionLayoutNode => ({
  type: "split",
  direction: "horizontal",
  ratio,
  first,
  second,
});

describe("splitRatio", () => {
  it("returns value within range", () => {
    expect(splitRatio(0.5)).toBe(0.5);
  });

  it("clamps below MIN_SPLIT_RATIO", () => {
    expect(splitRatio(0)).toBe(MIN_SPLIT_RATIO);
  });

  it("clamps above MAX_SPLIT_RATIO", () => {
    expect(splitRatio(1)).toBe(MAX_SPLIT_RATIO);
  });
});

describe("layoutLeaves", () => {
  it("returns empty array for undefined node", () => {
    expect(layoutLeaves(undefined)).toEqual([]);
  });

  it("returns single leaf id for leaf node", () => {
    expect(layoutLeaves(leaf("pane-1"))).toEqual(["pane-1"]);
  });

  it("returns all leaf ids for split node", () => {
    const tree = split(leaf("a"), leaf("b"));
    expect(layoutLeaves(tree)).toEqual(["a", "b"]);
  });

  it("returns deeply nested leaf ids in order", () => {
    const tree = split(split(leaf("a"), leaf("b")), leaf("c"));
    expect(layoutLeaves(tree)).toEqual(["a", "b", "c"]);
  });
});

describe("firstLeaf", () => {
  it("returns first leaf id", () => {
    const tree = split(split(leaf("a"), leaf("b")), leaf("c"));
    expect(firstLeaf(tree)).toBe("a");
  });

  it("returns empty string for undefined", () => {
    expect(firstLeaf(undefined)).toBe("");
  });
});

describe("ratioFromKeyboard", () => {
  it("increases ratio for ArrowRight", () => {
    const result = ratioFromKeyboard(0.5, "ArrowRight");
    expect(result).toBeGreaterThan(0.5);
  });

  it("decreases ratio for ArrowLeft", () => {
    const result = ratioFromKeyboard(0.5, "ArrowLeft");
    expect(result).toBeLessThan(0.5);
  });

  it("increases ratio for ArrowDown", () => {
    const result = ratioFromKeyboard(0.5, "ArrowDown");
    expect(result).toBeGreaterThan(0.5);
  });

  it("decreases ratio for ArrowUp", () => {
    const result = ratioFromKeyboard(0.5, "ArrowUp");
    expect(result).toBeLessThan(0.5);
  });

  it("returns MIN_SPLIT_RATIO for Home", () => {
    expect(ratioFromKeyboard(0.5, "Home")).toBe(MIN_SPLIT_RATIO);
  });

  it("returns MAX_SPLIT_RATIO for End", () => {
    expect(ratioFromKeyboard(0.5, "End")).toBe(MAX_SPLIT_RATIO);
  });

  it("returns undefined for unknown key", () => {
    expect(ratioFromKeyboard(0.5, "KeyA")).toBeUndefined();
  });

  it("uses larger step with shiftKey", () => {
    const normalStep = ratioFromKeyboard(0.5, "ArrowRight")!;
    const shiftStep = ratioFromKeyboard(0.5, "ArrowRight", true)!;
    expect(shiftStep - 0.5).toBeGreaterThan(normalStep - 0.5);
  });

  it("clamps at boundaries", () => {
    expect(ratioFromKeyboard(MAX_SPLIT_RATIO, "ArrowRight")).toBe(MAX_SPLIT_RATIO);
    expect(ratioFromKeyboard(MIN_SPLIT_RATIO, "ArrowLeft")).toBe(MIN_SPLIT_RATIO);
  });
});
