# Implementer Brief: Session List Refresh After Delete

## Context

Repo: `/home/esko/crostini-ghostty-terminal`

The user reported:

1. Session list is not always updating.
2. Deleting a session can reveal another stale session.

Relevant files:

- `web/src/main.ts`
- `web/e2e/app.spec.ts` only if a focused regression test is useful.

Current code:

- `renderLandingSpaceList()` fetches spaces and updates `listedSpaces` / `listedSessions`.
- `renderLandingRecentSessions()` renders from the current `listedSpaces` / `listedSessions`.
- `refreshLandingData()` fetches spaces, then calls `void renderLandingSpaceList(spaceList)` and `void renderLandingRecentSessions()`, which can race because `renderLandingSpaceList()` fetches again asynchronously.
- Empty-state delete buttons inside `renderLandingRecentSessions()` call `refreshLandingData()`.
- `deleteTerminalSession()` also calls `refreshLandingData()`.

Required behavior:

- After deleting a session/tab, the landing session list must be based on one authoritative fresh `/api/spaces` result.
- Avoid races caused by overlapping fetches.
- Deleting a session should not briefly reveal stale sessions.
- If selected space is deleted or no longer exists, fallback deterministically to default or first available space.
- Keep existing API behavior.

Validation:

```bash
/home/esko/.bun/bin/bun run --cwd web test
/home/esko/.bun/bin/bun run --cwd web build
```

Report changed files and any caveats. Do not commit.
