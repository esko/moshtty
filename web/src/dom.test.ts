import { describe, expect, it } from "vitest";
import { clamp, escapeAttribute, escapeHTML, formatNumber, pathBaseName, socketState, concatBytes } from "./dom";

describe("clamp", () => {
  it("returns value within range unchanged", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("clamps below minimum", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it("clamps above maximum", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("returns boundary value at exact edge", () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("handles negative ranges", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });

  it("handles fractional values", () => {
    expect(clamp(0.555, 0.2, 0.8)).toBeCloseTo(0.555);
  });
});

describe("escapeAttribute", () => {
  it("escapes ampersand", () => {
    expect(escapeAttribute("a&b")).toBe("a&amp;b");
  });

  it("escapes double quotes", () => {
    expect(escapeAttribute('a"b')).toBe("a&quot;b");
  });

  it("escapes less-than and greater-than", () => {
    expect(escapeAttribute("a<b>c")).toBe("a&lt;b&gt;c");
  });

  it("escapes multiple characters", () => {
    expect(escapeAttribute('"<&>"')).toBe("&quot;&lt;&amp;&gt;&quot;");
  });

  it("returns empty string unchanged", () => {
    expect(escapeAttribute("")).toBe("");
  });

  it("returns safe string unchanged", () => {
    expect(escapeAttribute("hello world")).toBe("hello world");
  });
});

describe("escapeHTML", () => {
  it("delegates to escapeAttribute", () => {
    expect(escapeHTML("a&b<c>d")).toBe("a&amp;b&lt;c&gt;d");
  });
});

describe("formatNumber", () => {
  it("formats integers without decimal", () => {
    expect(formatNumber(15)).toBe("15");
  });

  it("formats decimals to 2 places", () => {
    expect(formatNumber(1.75)).toBe("1.75");
  });

  it("trims trailing zeros", () => {
    expect(formatNumber(2.0)).toBe("2");
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("handles NaN and Infinity as '0'", () => {
    expect(formatNumber(NaN)).toBe("0");
    expect(formatNumber(Infinity)).toBe("0");
    expect(formatNumber(-Infinity)).toBe("0");
  });
});

describe("pathBaseName", () => {
  it("returns last segment of a path", () => {
    expect(pathBaseName("/usr/bin/bash")).toBe("bash");
  });

  it("returns single segment unchanged", () => {
    expect(pathBaseName("bash")).toBe("bash");
  });

  it("returns empty string for trailing slash", () => {
    expect(pathBaseName("/usr/bin/")).toBe("/usr/bin/");
  });

  it("returns empty string for root", () => {
    expect(pathBaseName("/")).toBe("/");
  });
});

describe("socketState", () => {
  it("returns 'none' for null", () => {
    expect(socketState(null)).toBe("none");
  });

  it("returns 'connecting' for CONNECTING", () => {
    const ws = { readyState: WebSocket.CONNECTING } as WebSocket;
    expect(socketState(ws)).toBe("connecting");
  });

  it("returns 'open' for OPEN", () => {
    const ws = { readyState: WebSocket.OPEN } as WebSocket;
    expect(socketState(ws)).toBe("open");
  });

  it("returns 'closing' for CLOSING", () => {
    const ws = { readyState: WebSocket.CLOSING } as WebSocket;
    expect(socketState(ws)).toBe("closing");
  });

  it("returns 'closed' for CLOSED", () => {
    const ws = { readyState: WebSocket.CLOSED } as WebSocket;
    expect(socketState(ws)).toBe("closed");
  });

  it("returns 'none' for undefined readyState", () => {
    const ws = {} as WebSocket;
    expect(socketState(ws)).toBe("none");
  });
});

describe("concatBytes", () => {
  it("returns single chunk unchanged", () => {
    const chunk = new Uint8Array([1, 2, 3]);
    const result = concatBytes([chunk]);
    expect(result).toBe(chunk);
  });

  it("concatenates multiple chunks", () => {
    const a = new Uint8Array([1, 2]);
    const b = new Uint8Array([3, 4, 5]);
    const c = new Uint8Array([6]);
    const result = concatBytes([a, b, c]);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it("returns empty array for no chunks", () => {
    const result = concatBytes([]);
    expect(result).toEqual(new Uint8Array(0));
  });
});
