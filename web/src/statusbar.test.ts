import { describe, expect, it } from "vitest";
import { getClockTimeString } from "./statusbar";

describe("getClockTimeString", () => {
  it("returns a string with colon separator", () => {
    const result = getClockTimeString();
    expect(typeof result).toBe("string");
    expect(result).toMatch(/^\d{2}:\d{2}$/);
  });

  it("returns 24-hour format", () => {
    const result = getClockTimeString();
    const [hours, minutes] = result.split(":").map(Number);
    expect(hours).toBeGreaterThanOrEqual(0);
    expect(hours).toBeLessThanOrEqual(23);
    expect(minutes).toBeGreaterThanOrEqual(0);
    expect(minutes).toBeLessThanOrEqual(59);
  });
});
