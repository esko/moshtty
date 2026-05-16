import { join } from "node:path";

type GlyphGapResults = {
  error?: string;
  checks?: Array<{
    name: string;
    passed: boolean;
    emptyColumnCount?: number;
    emptyColumns?: number[];
  }>;
};

const root = join(import.meta.dir, "..");
const server = Bun.serve({
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/visual/glyph-gap.html" : url.pathname;
    const file = Bun.file(join(root, decodeURIComponent(pathname)));
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(file);
  },
});

try {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: {
      width: 900,
      height: 240,
      deviceScaleFactor: Number(process.env.GLYPH_GAP_DPR ?? "1.19"),
    },
    args: ["--force-device-scale-factor=1.19"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/visual/glyph-gap.html`, {
      waitUntil: "networkidle0",
    });
    await page.waitForFunction("window.__glyphGapResults !== undefined", { timeout: 10_000 });
    const results = (await page.evaluate("window.__glyphGapResults")) as GlyphGapResults;

    if (results.error) {
      throw new Error(results.error);
    }
    const failures = results.checks?.filter((check) => !check.passed) ?? [];
    if (failures.length > 0) {
      throw new Error(
        failures
          .map(
            (check) =>
              `${check.name} failed (${check.emptyColumnCount ?? 0} empty columns: ${
                check.emptyColumns?.join(", ") ?? "?"
              })`,
          )
          .join("\n"),
      );
    }

    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  server.stop(true);
}
