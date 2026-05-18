# Spaces, Tabs, And Durable Sessions

The Go agent owns spaces, terminal tabs, and durable pane sessions. The browser uses HTTP APIs to create and arrange tabs, then attaches each visible pane to `/pty` with the pane session id.

## Model

`TerminalSession`:

```json
{
  "id": "term-0123abcd",
  "title": "Terminal",
  "customTitle": true,
  "spaceId": "space-default",
  "profileId": "profile-default",
  "parentId": "term-parent",
  "shell": "/bin/bash",
  "workingDir": "/home/me/project",
  "env": { "NODE_ENV": "development" },
  "status": "running",
  "createdAt": "2026-05-17T10:00:00Z",
  "updatedAt": "2026-05-17T10:00:00Z",
  "pid": 1234,
  "paneCount": 2
}
```

`customTitle`, `spaceId`, `profileId`, `parentId`, `shell`, `workingDir`, `env`, `pid`, and `paneCount` are omitted when they do not apply. Parent sessions are terminal tabs inside a space. Child sessions are panes inside a terminal tab and are hidden from space tab lists. Empty titles reset a session to automatic naming from the shell basename or `Terminal`.

`Profile`:

```json
{
  "id": "profile-default",
  "title": "Default Profile",
  "shell": "/bin/bash",
  "workingDir": "/home/me/project",
  "env": { "NODE_ENV": "development" },
  "createdAt": "2026-05-17T10:00:00Z",
  "updatedAt": "2026-05-17T10:00:00Z"
}
```

Profiles define launch defaults for new terminal tabs and panes. The agent snapshots `profileId`, `shell`, `workingDir`, and `env` into session metadata when the session is created, so changing or deleting a profile does not mutate existing sessions.

`Space`:

```json
{
  "id": "space-default",
  "title": "Default Space",
  "createdAt": "2026-05-17T10:00:00Z",
  "updatedAt": "2026-05-17T10:00:00Z",
  "tabCount": 1,
  "tabs": []
}
```

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

`TerminalTabWorkspace`:

```json
{
  "session": {},
  "tab": {},
  "layout": {},
  "children": [],
  "panes": []
}
```

`session` and `tab` both contain the parent tab session for compatibility. `layout` is the tab split tree. `children` and `panes` both contain the pane sessions referenced by the layout leaves.

## HTTP API

`GET /api/profiles`

Returns launch profiles. The agent creates `profile-default` automatically.

`POST /api/profiles`

Creates a profile.

Request:

```json
{
  "title": "Project",
  "shell": "/bin/bash",
  "workingDir": "/home/me/project",
  "env": { "NODE_ENV": "development" }
}
```

`shell` and `workingDir` may be blank for automatic shell and home directory defaults. Non-blank paths must be absolute; `workingDir` must point at an existing directory. Environment variable names must be shell-safe names like `KEY` or `PROJECT_ROOT`.

`PATCH /api/profiles/{profileId}`

Updates a non-default profile.

`DELETE /api/profiles/{profileId}`

Deletes a non-default profile. Existing sessions keep their snapshotted launch fields.

`GET /api/spaces`

Returns spaces with their terminal tabs. The agent creates `space-default` automatically and lazily migrates legacy parent sessions into it.

`POST /api/spaces`

Creates a space.

Request:

```json
{ "title": "Work" }
```

Blank or missing titles become `New Space`.

`GET /api/spaces/{spaceId}`

Returns one space with its tabs.

`PATCH /api/spaces/{spaceId}`

Renames a space.

Request:

```json
{ "title": "Ops" }
```

Blank titles reset to `Default Space` for `space-default` and `New Space` for other spaces.

`DELETE /api/spaces/{spaceId}`

Deletes an empty non-default space. The default space cannot be deleted, and spaces with tabs are rejected.

`POST /api/spaces/{spaceId}/tabs`

Creates a new terminal tab in a space, writes a single-pane layout, starts the worker, and returns the created parent `TerminalSession`.

Request:

```json
{ "profileId": "profile-default" }
```

Blank or missing `profileId` uses `profile-default`.

`GET /api/tabs/{tabId}`

Returns a `TerminalTabWorkspace` for a terminal tab.

`PATCH /api/tabs/{tabId}`

Renames a terminal tab.

`DELETE /api/tabs/{tabId}`

Stops every pane in the tab layout tree and removes the tab and child pane session directories.

`POST /api/tabs/{tabId}/restart`

Restarts every pane in the tab while preserving the tab id, pane ids, metadata, and split layout. Capture replay logs are removed before panes reconnect.

`POST /api/tabs/{tabId}/splits`

Creates a child pane in a terminal tab. Missing `profileId` inherits the target pane profile snapshot.

Request:

```json
{
  "targetSessionId": "term-parent",
  "direction": "horizontal",
  "profileId": "profile-default"
}
```

`PATCH /api/tabs/{tabId}/layout`

Persists split-pane geometry for a terminal tab. This endpoint only updates split ratios; it rejects layout submissions that change pane membership, leaf order, split structure, or split direction.

`PATCH /api/panes/{paneId}`

Renames a pane.

`DELETE /api/panes/{paneId}`

Removes a pane from its parent tab layout, stops that pane, and removes its session directory.

`POST /api/panes/{paneId}/restart`

Restarts one pane while preserving its id, metadata, and layout membership. Capture replay is removed before the pane reconnects.

## Compatibility API

`GET /api/terminal-sessions`

Returns parent terminal tabs only. Child panes are represented by the parent tab `paneCount`.

`GET /api/terminal-sessions/orphans`

Returns child pane `TerminalSession` records whose `parentId` points at a missing parent metadata file, a missing parent layout, or a parent layout that no longer references the child pane id. Parent tabs are never returned as orphans.

`DELETE /api/terminal-sessions/orphans`

Stops and removes all currently orphaned child pane session directories.

Response:

```json
{ "deleted": 1 }
```

`POST /api/terminal-sessions`

Creates a new parent tab in the default space.

`GET /api/terminal-sessions/{id}`

Returns a `TerminalTabWorkspace` for a parent session id.

`PATCH /api/terminal-sessions/{id}`

Renames a parent tab or child pane.

Request:

```json
{ "title": "Work API" }
```

Whitespace is trimmed. A blank title clears the custom name and returns the session to automatic naming.

`POST /api/terminal-sessions/{id}/splits`

Creates a child pane in a parent tab.

Request:

```json
{
  "targetSessionId": "term-parent",
  "direction": "horizontal"
}
```

`direction` is `horizontal` for side-by-side panes or `vertical` for stacked panes. The response is the updated `Workspace`.

`POST /api/terminal-sessions/{id}/detach`

Promotes a child pane into a parent tab.

Request:

```json
{ "sessionId": "term-child" }
```

The child is removed from the old parent layout, its `parentId` is cleared, and a single-pane layout is written under the detached session id.

`PATCH /api/terminal-sessions/{id}/layout`

Persists split-pane geometry for a parent tab. This endpoint only updates split ratios; it rejects layout submissions that change pane membership, leaf order, split structure, or split direction.

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

If `{id}` is a parent tab, stops every pane in its layout tree and removes the parent and child session directories. If `{id}` is a child pane, removes it from the parent layout, stops only that pane, and removes the child session directory.

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
- Startup and attach errors keep the same JSON shape and may include bounded recent `worker.log` context in the `errors` array.
