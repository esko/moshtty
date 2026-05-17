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

The app stylesheet now exposes semantic CSS variables. The next appearance pass should add settings for app chrome colors, accent/focus color, compactness, and terminal palette selection while keeping terminal ANSI colors separate from app UI colors.

## 4. Session Reliability

Durable sessions should expose clearer lifecycle controls and recovery states. Useful additions include stale worker cleanup, restart session, reconnect pane, orphan detection, and better failure messages when a worker cannot start.

## 5. Pane Keyboard Workflow

Pane shortcuts should cover common layout operations without conflicting with ChromeOS or terminal control keys. Candidate actions: split right/down, close pane, focus next/previous pane, and detach pane.

## 6. Context Menu Functionality

The terminal context menu can become the main discoverable pane command surface. Candidate actions: rename, restart, duplicate, copy session id, close workspace, and open appearance settings.

## 7. Session List UX

The app menu should evolve from a flat parent-session list into a workspace overview. Useful additions include nested pane counts/details, last updated time, shell/status indicators, confirm delete, and quick restore/open actions.

## 8. Profiles

Profiles should come after settings and session naming are stable. A profile can define shell path, environment variables, working directory, font/theme overrides, and startup behavior for new workspaces.
