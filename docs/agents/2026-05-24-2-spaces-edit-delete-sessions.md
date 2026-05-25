# Implementer Brief: Spaces Naming, Edit Dialog, Delete Behavior, and Duplicate New Session Button

## Context

Repo: `/home/esko/crostini-ghostty-terminal`

Current UI work is in progress. Keep changes focused to `web/src/main.ts`, `web/src/styles.css`, and existing dialogs in `web/index.html` if needed.

Reference screenshots from ChromeOS Downloads. Inspect these before editing:

- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.04.png` - main spaces/projects page.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.17.png` - spaces page with topbar and project menu actions visible.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.25.png` - edit project modal with name, icon, color swatches, startup script.
- `/mnt/chromeos/MyFiles/Downloads/Screenshot 2026-05-24 18.46.36.png` - settings modal with left navigation and grouped rows.

Design direction from the screenshots: the edit popup is a compact centered modal, not a full page. It has a clear title, close button, full-width name input, square icon preview, muted helper text, color swatches, a startup script text field, and bottom-right Cancel/Save actions.

The user specifically asked:

1. Rename "Projects" to "Spaces".
2. Remove delete confirmation from projects/spaces.
3. Add the missing edit popup for projects/spaces, matching the screenshot direction:
   - Modal titled "Edit space" or "Edit project" depending on final naming; user asked to rename projects to spaces, so prefer "Edit space".
   - Name input.
   - Icon preview area.
   - Color swatches.
   - Optional workspace startup script field can be present as UI-only if no backend support exists, but do not invent backend API fields unless existing types support it.
4. Remove the extra bottom "New session" button in the empty state. There should only be the top-right new session action in the home content.

Relevant current code:

- `renderSettingsPage()` creates the landing page.
- `renderLandingSpaceList()` renders left-side space list.
- `renderLandingRecentSessions()` currently adds a second `#landingNewSessionBtn` inside the empty state.
- `openRenameDialogForSpace()` / `openMenuSpaceRenameDialog()` currently use the generic rename dialog.
- `deleteSpace()` currently uses `window.confirm(...)`.

## Required Behavior

- The left section label says "Spaces", not "Projects".
- Any visible copy saying "project" in the landing page should become "space" when it refers to this model.
- Delete space should happen directly when the delete action is clicked, with no browser confirm.
  - Preserve existing guardrails: do not delete default space, do not delete non-empty spaces unless existing backend supports it. Keep disabled state if needed.
- Add an edit popup for spaces:
  - Editing a space from the space list should open this popup.
  - Name edits should still call the existing `PATCH /api/spaces/{id}` path.
  - Include icon/color UI in the modal to match screenshots. Since the current API appears to support only `title`, store color/icon UI only in frontend state if simple, or leave them visual-only with disabled/no persistence only if you clearly label in code comments. Prefer no user-facing "not supported" copy.
- Empty sessions state should only show text. Remove the bottom "New session" button.

## Suggested Implementation Notes

- A dedicated `spaceEditDialog` is cleaner than overloading `renameDialog`, but use existing patterns.
- If adding a new dialog in `web/index.html`, wire required elements near the existing dialog constants.
- Keep all new functions in `web/src/main.ts`; do not add a new module unless you also add a corresponding `.test.ts`.
- Avoid `window.confirm` for spaces only. Do not change tab/profile/orphan confirmations unless needed.

## Validation

Run:

```bash
/home/esko/.bun/bin/bun run --cwd web test
/home/esko/.bun/bin/bun run --cwd web build
```

Report exactly what changed and any caveats. Do not commit.
