import { afterEach, describe, expect, it, vi } from "vitest";

describe("ghostty-web canvas scaling", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "window");
  });

  it("uses the rounded backing-store ratio instead of raw fractional DPR", async () => {
    const renderContext = {
      scale: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
      textAlign: "",
      textBaseline: "",
    };
    const measureContext = {
      font: "",
      measureText: () => ({
        width: 9,
        fontBoundingBoxAscent: 14.2,
        fontBoundingBoxDescent: 4.3,
      }),
    };
    const canvas = {
      width: 0,
      height: 0,
      style: {} as Record<string, string>,
      getContext: () => renderContext,
    };

    vi.stubGlobal("window", { devicePixelRatio: 1.19 });
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => measureContext,
      }),
    });

    const { CanvasRenderer } = await import("ghostty-web");
    const renderer = new CanvasRenderer(canvas as unknown as HTMLCanvasElement, {
      devicePixelRatio: 1.19,
      fontSize: 15,
    });

    renderer.resize(86, 48);

    const cssWidth = 86 * 9;
    const cssHeight = 48 * 19;
    const backingWidth = Math.round(cssWidth * 1.19);
    const backingHeight = Math.round(cssHeight * 1.19);

    expect(canvas.width).toBe(backingWidth);
    expect(canvas.height).toBe(backingHeight);
    expect(renderContext.scale).toHaveBeenCalledWith(
      backingWidth / cssWidth,
      backingHeight / cssHeight,
    );
  });
});
