# Fonts

The PWA bundles JetBrains Mono so terminal metrics are stable in an installed ChromeOS app. The active font source is:

- `web/public/fonts/JetBrainsMono-Regular.ttf`

`web/src/styles.css` declares the font with `font-display: block`, and `web/src/main.ts` configures the terminal with:

```text
JetBrains Mono, Noto Sans Mono, monospace
```

Keep font changes conservative. Font metrics directly affect terminal grid size, PTY resize messages, canvas backing dimensions, and glyph-gap behavior on fractional-DPR displays. After changing fonts or font size, run:

```bash
cd web
bun run test
bun run test:visual:glyphs
```
