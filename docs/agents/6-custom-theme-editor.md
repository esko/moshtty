# Custom Theme Editor

Restore the custom terminal palette JSON editor that was removed during refactoring.

## Files to Change

### `web/src/main.ts` — Template HTML (~15 lines added in `renderSettingsPage`)

After the `<select id="theme">` closing `</label>`, insert the custom theme container DIV:

```html
<div id="customThemeContainer" style="display: none; padding: 14px 15px; border-bottom: 1px solid var(--color-border-subtle); grid-column: 1 / -1;">
  <span><strong>Custom palette JSON</strong><small>Edit palette colors as JSON.</small></span>
  <textarea id="customThemeJson" style="width: 100%; min-height: 120px; font-family: var(--font-mono); font-size: 11px; padding: 8px; border: 1px solid var(--color-border-strong); border-radius: var(--radius-md); background: var(--color-app-bg); color: var(--color-text-bright); resize: vertical; margin-top: 4px;" spellcheck="false"></textarea>
  <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; width: 100%; margin-top: 6px;">
    <span id="customThemeError" style="color: var(--color-danger); font-size: 11px; margin-right: auto; display: none;"></span>
    <input type="file" id="importThemeFile" accept=".json" style="display: none;" />
    <button type="button" class="secondary-button compact-button" id="importThemeBtn">Import</button>
    <button type="button" class="secondary-button compact-button" id="exportThemeBtn">Export</button>
  </div>
</div>
```

Insert this immediately after the palette `<select></label>` block, before the accent select.

### `web/src/main.ts` — JS Logic (~50 lines added after form element lookups)

After the `const keybindingsList = requiredElement<HTMLElement>("#keybindingsList");` line (around line 1347), add:

```ts
const customThemeContainer = requiredElement<HTMLElement>("#customThemeContainer");
const customThemeJson = requiredElement<HTMLTextAreaElement>("#customThemeJson");
const customThemeError = requiredElement<HTMLElement>("#customThemeError");
const importBtn = requiredElement<HTMLButtonElement>("#importThemeBtn");
const importFile = requiredElement<HTMLInputElement>("#importThemeFile");
const exportBtn = requiredElement<HTMLButtonElement>("#exportThemeBtn");

const updateCustomThemeVisibility = () => {
  if (theme.value === "custom") {
    customThemeContainer.style.display = "grid";
    if (!customThemeJson.value.trim()) {
      const palette = settings.theme.preset === "custom"
        ? (settings.theme as { preset: "custom"; palette: TerminalPalette }).palette
        : getThemePalette(settings.theme);
      customThemeJson.value = JSON.stringify(palette, null, 2);
    }
  } else {
    customThemeContainer.style.display = "none";
  }
};

theme.addEventListener("change", updateCustomThemeVisibility);
updateCustomThemeVisibility();

importBtn.addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", () => {
  const file = importFile.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target?.result;
      if (typeof text !== "string") return;
      const parsed = JSON.parse(text);
      customThemeJson.value = JSON.stringify(parsed, null, 2);
      customThemeError.style.display = "none";
      customThemeError.textContent = "";
      theme.value = "custom";
      updateCustomThemeVisibility();
    } catch (err: any) {
      customThemeError.textContent = `Import failed: ${err.message}`;
      customThemeError.style.display = "block";
    }
  };
  reader.readAsText(file);
  importFile.value = "";
});

exportBtn.addEventListener("click", () => {
  let paletteToExport: TerminalPalette;
  if (theme.value === "custom") {
    try {
      paletteToExport = JSON.parse(customThemeJson.value);
    } catch {
      paletteToExport = getThemePalette({ preset: "dark" });
    }
  } else {
    paletteToExport = getThemePalette({ preset: theme.value });
  }
  const blob = new Blob([JSON.stringify(paletteToExport, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${paletteToExport.name || "theme"}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
```

### Notes

- `readSettingsForm()` already handles the `#customThemeJson` textarea (it was updated earlier to use `document.querySelector` instead of `requiredElement`, so it won't throw if the element is hidden)
- `TerminalPalette` is already imported from `./types`
- `getThemePalette` is already imported from `./themes`
- The container uses `grid-column: 1 / -1` to span both columns of the `.setting-row` grid layout

## Verification

```bash
cd web && bun run test && bun run build
cd agent && go test ./...
```

Manual test:
1. Open settings page
2. Select "Custom" from theme dropdown — textarea should appear with current palette JSON
3. Switch to another preset — textarea should hide
4. Edit JSON, click Save — palette should persist
5. Click Export — JSON file should download
6. Click Import, select valid theme JSON — textarea should populate, theme switches to custom
7. Click Import, select invalid JSON — error message should show
