# Durable Sessions

The Go agent owns durable terminal sessions. The browser uses HTTP APIs to create and arrange sessions, then attaches each visible pane to `/pty` with the session id.

## Model

`TerminalSession`:

```json
{
  "id": "term-0123abcd",
  "title": "Terminal",
  "parentId": "term-parent",
  "shell": "/bin/bash",
  "status": "running",
  "createdAt": "2026-05-17T10:00:00Z",
  "updatedAt": "2026-05-17T10:00:00Z",
  "pid": 1234,
  "paneCount": 2
}
```

`parentId`, `shell`, `pid`, and `paneCount` are omitted when they do not apply. Parent sessions are workspaces. Child sessions are panes inside a parent workspace and are hidden from the top-level list.

`SessionLayoutNode`:

```json
{ "type": "leaf", "sessionId": "term-0123abcd" }
```

```json
{
  "type": "split",
  "direction": "horizontal",
  "ratio": 0.5,
  "first": { "type": "leaf", "sessionId": "term-parent" },
  "second": { "type": "leaf", "sessionId": "term-child" }
}
```

`Workspace`:

```json
{
  "session": {},
  "layout": {},
  "children": []
}
```

`session` is the parent workspace, `layout` is its split tree, and `children` contains the pane sessions referenced by the layout leaves.

## HTTP API

`GET /api/terminal-sessions`

Returns parent workspaces only. Child panes are represented by the parent workspace `paneCount`.

`POST /api/terminal-sessions`

Creates a new parent workspace, writes a single-pane layout, starts the worker, and returns the created `TerminalSession`.

`GET /api/terminal-sessions/{id}`

Returns a `Workspace` for a parent session id.

`POST /api/terminal-sessions/{id}/splits`

Creates a child pane in a parent workspace.

Request:

```json
{
  "targetSessionId": "term-parent",
  "direction": "horizontal"
}
```

`direction` is `horizontal` for side-by-side panes or `vertical` for stacked panes. The response is the updated `Workspace`.

`POST /api/terminal-sessions/{id}/detach`

Promotes a child pane into a parent workspace.

Request:

```json
{ "sessionId": "term-child" }
```

The child is removed from the old parent layout, its `parentId` is cleared, and a single-pane layout is written under the detached session id.

`PATCH /api/terminal-sessions/{id}/layout`

Persists split-pane geometry for a parent workspace. This endpoint only updates split ratios; it rejects layout submissions that change pane membership, leaf order, split structure, or split direction.

Request:

```json
{
  "layout": {
    "type": "split",
    "direction": "horizontal",
    "ratio": 0.6,
    "first": { "type": "leaf", "sessionId": "term-parent" },
    "second": { "type": "leaf", "sessionId": "term-child" }
  }
}
```

Ratios are clamped to `0.2..0.8`. The response is the updated `Workspace`.

`DELETE /api/terminal-sessions/{id}`

If `{id}` is a parent workspace, stops every pane in its layout tree and removes the parent and child session directories. If `{id}` is a child pane, removes it from the parent layout, stops only that pane, and removes the child session directory.

## PTY Attachment

Visible terminal panes attach through:

```text
GET /pty?token=<session-token>&session=<session-id>&restore=1&cols=120&rows=32
```

`session` selects the durable pane session. If it is omitted, the agent creates a new parent session. `restore=1` replays the worker capture log on first attachment. `cols` and `rows` set the initial PTY size.

Browser-to-agent WebSocket text frames:

```json
{"type":"input","data":"echo hello\n"}
{"type":"resize","cols":120,"rows":32}
```

Agent-to-browser frames:

- Binary frames contain raw PTY output bytes.
- Text JSON frames report status, errors, and process exit.
