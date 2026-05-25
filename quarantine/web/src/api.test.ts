import { describe, expect, it, beforeEach, vi } from "vitest";
import { ptyURL } from "./api";

describe("ptyURL", () => {
  const token = "test-token-abc";
  const sessionId = "session-1";

  it("builds ws URL with all parameters", () => {
    const url = ptyURL(token, sessionId, false, 120, 40, "http://127.0.0.1:8765/");
    expect(url).toContain("ws://127.0.0.1:8765/pty?");
    expect(url).toContain("token=test-token-abc");
    expect(url).toContain("session=session-1");
    expect(url).toContain("restore=0");
    expect(url).toContain("cols=120");
    expect(url).toContain("rows=40");
  });

  it("uses wss for https origin", () => {
    const url = ptyURL(token, sessionId, false, 80, 24, "https://example.com/");
    expect(url.startsWith("wss://")).toBe(true);
  });

  it("uses ws for http origin", () => {
    const url = ptyURL(token, sessionId, false, 80, 24, "http://example.com/");
    expect(url.startsWith("ws://")).toBe(true);
  });

  it("sets restore=1 when true", () => {
    const url = ptyURL(token, sessionId, true, 80, 24, "http://127.0.0.1:8765/");
    expect(url).toContain("restore=1");
  });

  it("defaults cols to 100 when 0", () => {
    const url = ptyURL(token, sessionId, false, 0, 30, "http://127.0.0.1:8765/");
    expect(url).toContain("cols=100");
  });

  it("defaults rows to 30 when 0", () => {
    const url = ptyURL(token, sessionId, false, 80, 0, "http://127.0.0.1:8765/");
    expect(url).toContain("rows=30");
  });
});
