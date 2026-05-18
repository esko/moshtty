import { describe, it, expect } from "vitest";
import { escapeAttribute } from "./dom";

describe("escapeAttribute", () => {
  it("escapes special characters", () => {
    expect(escapeAttribute(`&"'<>`)).toBe("&amp;&quot;&#39;&lt;&gt;");
  });

  it("escapes multiple instances of special characters", () => {
    expect(escapeAttribute(`&"'<>&"'<>`)).toBe("&amp;&quot;&#39;&lt;&gt;&amp;&quot;&#39;&lt;&gt;");
  });

  it("returns normal strings unchanged", () => {
    expect(escapeAttribute("hello world")).toBe("hello world");
  });
});
