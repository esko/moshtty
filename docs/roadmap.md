# Roadmap

This roadmap tracks near-term feature targets after the durable session and split-pane foundation.

## 1. Resizable Split Panes

Status: complete.

Resizable panes complete the current split-session model. The session layout already stores split ratios, so the work is focused on interactive dividers, persistence, and validation rather than a new layout system.

Completed outcome:

- drag split dividers with pointer input;
- resize focused dividers with keyboard input;
- persist ratios through `PATCH /api/terminal-sessions/{id}/layout`;
- keep layout updates limited to geometry changes;
- recover from rejected layout persistence by reloading the server-backed workspace.

## 2. Session And Pane Naming

Status: complete.

Human-readable names are the next usability upgrade after panes can be arranged. Parent workspaces and child panes should be renameable, and titles should appear consistently in the app menu, terminal status, context menu actions, and native tab title.

Completed outcome:

- rename parent workspaces from the app menu;
- rename the active pane from the terminal context menu;
- preserve custom names across worker metadata updates;
- reset blank names to automatic shell/default titles.

## 3. Appearance Settings

Status: complete.

The app stylesheet now exposes semantic CSS variables and the app menu has controls for terminal palette, app accent, and app density. Terminal ANSI colors remain separate from app chrome colors.

Completed outcome:

- choose the terminal palette used by new tabs;
- choose the app accent used for controls, focus rings, and status highlights;
- switch app chrome between comfortable and compact density;
- normalize invalid stored appearance values back to stable defaults.

## 4. Session Reliability

Status: complete.

Durable sessions now have a higher-level space model, tab/pane API names, persisted stale-status detection, restart controls for a pane or a whole tab, multi-space management, orphan pane detection/cleanup, and worker-start failure messages with bounded recent log context.

## 5. Pane Keyboard Workflow

Status: complete.

Pane shortcuts cover common layout operations without conflicting with ChromeOS or terminal control keys.

Completed outcome:

- split right/down with `Ctrl+Shift+ArrowRight` and `Ctrl+Shift+ArrowDown`;
- focus previous/next pane with `Ctrl+Shift+ArrowLeft` and `Ctrl+Shift+ArrowUp`;
- close the active pane with `Ctrl+Shift+Backspace`;
- detach a child pane with `Ctrl+Shift+D`;
- ignore app shortcuts while dialogs and normal editable controls are active.

## 6. Context Menu Functionality

Status: complete.

The terminal context menu is the main discoverable pane command surface.

Completed outcome:

- rename, duplicate, split, restart, detach, close, and clear panes;
- restart and close the current tab;
- copy pane and tab ids;
- open settings and create new terminal tabs;
- disable menu items that do not apply to the current pane/tab state.

## 7. Session List UX

Status: complete.

The app menu now shows spaces with nested terminal tabs instead of a flat parent-session list.

Completed outcome:

- group terminal tabs by space;
- show pane counts, status, and last-updated time;
- create, rename, and delete spaces;
- create, open, rename, restart, and delete tabs from the list;
- confirm destructive tab and space actions;
- surface orphan pane cleanup from the app menu.

## 8. Profiles

Status: complete.

Profiles define launch defaults for new terminal tabs and panes.

Completed outcome:

- list, create, edit, and delete non-default profiles from the app menu;
- choose the default profile for new terminal tabs;
- define shell path, working directory, and environment variables;
- snapshot profile launch fields into new sessions so later profile edits do not mutate existing sessions;
- have child panes inherit the target pane profile unless an explicit profile is supplied by the API.
