import { describe, expect, it } from "vitest";
import { isSettingsPath, isAppPath } from "./debug-shell";

describe("isSettingsPath", () => {
  it("matches root path", () => {
    expect(isSettingsPath("/")).toBe(true);
  });

  it("matches /index.html", () => {
    expect(isSettingsPath("/index.html")).toBe(true);
  });

  it("does not match /terminal.html", () => {
    expect(isSettingsPath("/terminal.html")).toBe(false);
  });

  it("does not match an arbitrary path", () => {
    expect(isSettingsPath("/some/other")).toBe(false);
  });
});

describe("isAppPath", () => {
  it("recognizes settings paths", () => {
    expect(isAppPath("/")).toBe(true);
    expect(isAppPath("/index.html")).toBe(true);
  });

  it("recognizes terminal paths", () => {
    expect(isAppPath("/terminal.html")).toBe(true);
    expect(isAppPath("/terminal")).toBe(true);
  });

  it("rejects non-app paths", () => {
    expect(isAppPath("/not-app")).toBe(false);
    expect(isAppPath("/api/health")).toBe(false);
  });
});
