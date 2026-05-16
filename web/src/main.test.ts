import { describe, expect, it } from "vitest";

describe("ghostty-web websocket URL", () => {
  it("uses ws for http origins", () => {
    const url = new URL("/pty", "http://127.0.0.1:8765/");
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", "abc");
    expect(url.toString()).toBe("ws://127.0.0.1:8765/pty?token=abc");
  });
});
