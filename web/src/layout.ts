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

export function findSpatialNeighbor(
  direction: "left" | "right" | "up" | "down",
  focusedPaneId: string,
  leafIds: string[],
): string | null {
  if (leafIds.length <= 1) return null;

  const focusEl = document.querySelector(`[data-pane-id="${focusedPaneId}"]`);
  if (!focusEl) return null;
  const focusRect = focusEl.getBoundingClientRect();
  const focusCenter = {
    x: focusRect.left + focusRect.width / 2,
    y: focusRect.top + focusRect.height / 2,
  };

  let bestId: string | null = null;
  let minDistance = Infinity;

  // First pass: try to find a pane strictly in the correct direction
  for (const id of leafIds) {
    if (id === focusedPaneId) continue;
    const el = document.querySelector(`[data-pane-id="${id}"]`);
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };

    let inDirection = false;
    switch (direction) {
      case "left":
        inDirection = center.x < focusCenter.x;
        break;
      case "right":
        inDirection = center.x > focusCenter.x;
        break;
      case "up":
        inDirection = center.y < focusCenter.y;
        break;
      case "down":
        inDirection = center.y > focusCenter.y;
        break;
    }

    if (inDirection) {
      const dist = Math.pow(center.x - focusCenter.x, 2) + Math.pow(center.y - focusCenter.y, 2);
      if (dist < minDistance) {
        minDistance = dist;
        bestId = id;
      }
    }
  }

  // Second pass: fallback if no pane strictly in the correct direction
  if (bestId === null) {
    for (const id of leafIds) {
      if (id === focusedPaneId) continue;
      const el = document.querySelector(`[data-pane-id="${id}"]`);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const dist = Math.pow(center.x - focusCenter.x, 2) + Math.pow(center.y - focusCenter.y, 2);
      if (dist < minDistance) {
        minDistance = dist;
        bestId = id;
      }
    }
  }

  return bestId;
}
