import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");
const ghosttyRoot = join(packageRoot, "node_modules", "ghostty-web");
const rendererPath = join(ghosttyRoot, "lib", "renderer.ts");
const terminalPath = join(ghosttyRoot, "lib", "terminal.ts");

let source = readFileSync(rendererPath, "utf8");

source = source.replace(
  "  private devicePixelRatio: number;\n  private scrollbarWidth: number;",
  "  private devicePixelRatio: number;\n  private canvasScaleX: number = 1;\n  private canvasScaleY: number = 1;\n  private scrollbarWidth: number;",
);

if (!source.includes("  private fillPixelRect(")) {
  source = source.replace(
    `  private rgbToCSS(r: number, g: number, b: number): string {
    return \`rgb(\${r}, \${g}, \${b})\`;
  }
`,
    `  private rgbToCSS(r: number, g: number, b: number): string {
    return \`rgb(\${r}, \${g}, \${b})\`;
  }

  private fillPixelRect(x: number, y: number, width: number, height: number): void {
    const x0 = Math.floor(x * this.canvasScaleX) / this.canvasScaleX;
    const y0 = Math.floor(y * this.canvasScaleY) / this.canvasScaleY;
    const x1 = Math.ceil((x + width) * this.canvasScaleX) / this.canvasScaleX;
    const y1 = Math.ceil((y + height) * this.canvasScaleY) / this.canvasScaleY;
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
`,
  );
}

source = source.replace(
  `  public resize(cols: number, rows: number): void {
    const cssWidth = cols * this.metrics.width;
    const cssHeight = rows * this.metrics.height;

    // Set CSS size (what user sees)
    this.canvas.style.width = \`\${cssWidth}px\`;
    this.canvas.style.height = \`\${cssHeight}px\`;

    // Set actual canvas size (scaled for DPI)
    this.canvas.width = cssWidth * this.devicePixelRatio;
    this.canvas.height = cssHeight * this.devicePixelRatio;

    // Scale context to match DPI (setting canvas.width/height resets the context)
    this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
`,
  `  public resize(cols: number, rows: number): void {
    const cssWidth = cols * this.metrics.width;
    const cssHeight = rows * this.metrics.height;
    const backingWidth = Math.max(1, Math.round(cssWidth * this.devicePixelRatio));
    const backingHeight = Math.max(1, Math.round(cssHeight * this.devicePixelRatio));
    this.canvasScaleX = backingWidth / cssWidth;
    this.canvasScaleY = backingHeight / cssHeight;

    // Set CSS size (what user sees)
    this.canvas.style.width = \`\${cssWidth}px\`;
    this.canvas.style.height = \`\${cssHeight}px\`;

    // Set actual canvas size (scaled for DPI). Canvas dimensions are integer
    // backing pixels, so use the rounded size and scale the context by the
    // resulting exact ratio. Scaling by the raw fractional DPR after the
    // browser coerces width/height to integers causes glyph edges to drift
    // from physical pixels and can show hairline gaps between adjacent cells.
    this.canvas.width = backingWidth;
    this.canvas.height = backingHeight;

    // Scale context to match DPI (setting canvas.width/height resets the context)
    this.ctx.scale(this.canvasScaleX, this.canvasScaleY);
`,
);

source = source.replace(
  `    const needsResize =
      this.canvas.width !== dims.cols * this.metrics.width * this.devicePixelRatio ||
      this.canvas.height !== dims.rows * this.metrics.height * this.devicePixelRatio;
`,
  `    const needsResize =
      this.canvas.width !==
        Math.round(dims.cols * this.metrics.width * this.devicePixelRatio) ||
      this.canvas.height !== Math.round(dims.rows * this.metrics.height * this.devicePixelRatio);
`,
);

source = source.replace(
  `    const canvasHeight = this.canvas.height / this.devicePixelRatio;
    const canvasWidth = this.canvas.width / this.devicePixelRatio;
`,
  `    const canvasHeight = this.canvas.height / this.canvasScaleY;
    const canvasWidth = this.canvas.width / this.canvasScaleX;
`,
);

source = source
  .split("\n")
  .map((line, index, lines) => {
    const before = lines.slice(0, index + 1).join("\n");
    const inCellPaint =
      before.lastIndexOf("  private renderLine(") >
        before.lastIndexOf("  private drawHorizontalLine(") ||
      before.lastIndexOf("  private renderBlockChar(") >
        before.lastIndexOf("  private renderBoxDrawing(");
    return inCellPaint ? line.replaceAll("this.ctx.fillRect(", "this.fillPixelRect(") : line;
  })
  .join("\n");

writeFileSync(rendererPath, source);

let terminalSource = readFileSync(terminalPath, "utf8");
terminalSource = terminalSource.replace(
  `      // Update canvas dimensions
      const metrics = this.renderer!.getMetrics();
      this.canvas!.width = metrics.width * cols;
      this.canvas!.height = metrics.height * rows;
      this.canvas!.style.width = \`\${metrics.width * cols}px\`;
      this.canvas!.style.height = \`\${metrics.height * rows}px\`;

`,
  "",
);
terminalSource = terminalSource
  .replace("      this.textarea.style.left = '0';", "      this.textarea.style.left = '-10000px';")
  .replace("      this.textarea.style.top = '0';", "      this.textarea.style.top = '-10000px';")
  .replace(
    /      this\.textarea\.style\.opacity = '0';\n(?:      this\.textarea\.style\.(?:color|background|caretColor|outline) = '(?:transparent|none)';\n)*/,
    `      this.textarea.style.opacity = '0';
      this.textarea.style.color = 'transparent';
      this.textarea.style.background = 'transparent';
      this.textarea.style.caretColor = 'transparent';
      this.textarea.style.outline = 'none';
`,
  );
writeFileSync(terminalPath, terminalSource);

const result = Bun.spawnSync(
  [
    Bun.argv[0],
    "build",
    "./lib/index.ts",
    "--outfile",
    "./dist/ghostty-web.js",
    "--format",
    "esm",
    "--target",
    "browser",
  ],
  {
    cwd: ghosttyRoot,
    stdout: "inherit",
    stderr: "inherit",
  },
);

if (!result.success) {
  process.exit(result.exitCode);
}
