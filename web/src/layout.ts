import { clamp } from "./dom";
import type { SessionLayoutNode } from "./types";

export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;

export function splitRatio(value: number): number {
  return clamp(value, MIN_SPLIT_RATIO, MAX_SPLIT_RATIO);
}

export function firstLeaf(node?: SessionLayoutNode): string {
  return layoutLeaves(node)[0] ?? "";
}

export function layoutLeaves(node?: SessionLayoutNode): string[] {
  if (!node) return [];
  if (node.type === "leaf") return [node.sessionId];
  return [...layoutLeaves(node.first), ...layoutLeaves(node.second)];
}

export function ratioFromPointer(direction: "horizontal" | "vertical", rect: DOMRect, clientX: number, clientY: number): number {
  const size = direction === "horizontal" ? rect.width : rect.height;
  if (size <= 0) return 0.5;
  const offset = direction === "horizontal" ? clientX - rect.left : clientY - rect.top;
  return splitRatio(offset / size);
}

export function ratioFromKeyboard(currentRatio: number, key: string, shiftKey = false): number | undefined {
  const step = shiftKey ? 0.1 : 0.05;
  switch (key) {
    case "ArrowLeft":
    case "ArrowUp":
      return splitRatio(currentRatio - step);
    case "ArrowRight":
    case "ArrowDown":
      return splitRatio(currentRatio + step);
    case "Home":
      return MIN_SPLIT_RATIO;
    case "End":
      return MAX_SPLIT_RATIO;
    default:
      return undefined;
  }
}

export function applySplitRatio(
  node: Extract<SessionLayoutNode, { type: "split" }>,
  first: HTMLElement,
  second: HTMLElement,
  ratio: number,
): void {
  const nextRatio = splitRatio(ratio);
  node.ratio = nextRatio;
  first.style.flexBasis = `${nextRatio * 100}%`;
  second.style.flexBasis = `${(1 - nextRatio) * 100}%`;
}
