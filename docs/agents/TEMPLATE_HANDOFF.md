# Handoff Template

Fill this and paste it into the commit body, PR description, or PRD close-out section when ending a task brief — successful, blocked, or partially deferred.

The point of this template is to make the next agent's life cheap: they should be able to read this and resume without re-reading the entire transcript.

```markdown
## Handoff — [brief filename]

### Slice summary

- **What shipped:** [1–3 sentence summary of the feature, fix, or doc.]
- **Brief / milestone:** [link to brief, e.g. `docs/agents/2026-05-25-5-moshtty-ui-ghostty.md` -> M5]
- **Owner:** [agent / model used, e.g. "Cursor (Opus)", "agy / Gemini 3.5 Flash", "deepseek-v4-pro via cmd"]
- **Status set:** [Ready for review / Verified on target / Blocked / Done]
- **Slice budget used:** [N changed files (excluding lockfiles) — soft cap 8, hard cap 20]

### Files changed
```

path/to/file.ts (+N / -M)
path/to/file.go (+N / -M)

```

Group by area when there are more than ~10 files (e.g. "renderer", "main", "common", "tests", "docs").

### Verification (commands actually run, with results)

- [ ] `pnpm --filter @moshtty/desktop typecheck` — [PASSED/FAILED, error summary]
- [ ] `pnpm --filter @moshtty/desktop lint` — [PASSED/FAILED]
- [ ] `pnpm --filter @moshtty/desktop lint:css` — [PASSED/FAILED]
- [ ] `pnpm --filter @moshtty/desktop test` — [PASSED/FAILED, N tests, M files]
- [ ] `pnpm --filter @moshtty/desktop test:coverage` — [PASSED/FAILED, % lines]
- [ ] `pnpm --filter @moshtty/desktop build` — [PASSED/FAILED]
- [ ] `pnpm --filter @moshtty/desktop test:visual` — [PASSED/FAILED/SKIPPED, reason]
- [ ] `go test ./...` — [PASSED/FAILED]
- [ ] `go vet ./...` — [PASSED/FAILED]
- [ ] `golangci-lint run ./...` — [PASSED/FAILED]
- [ ] `pnpm format:check` — [PASSED/FAILED]
- [ ] `git diff --check` — [CLEAN/DIRTY]

If a command was skipped, say why (no display, no Mac, scaffold not landed, etc.).

### On-target verification

Required for milestones with native dependencies (`safeStorage`, WebTransport, real Mosh). Otherwise mark N/A.

- [ ] Ran on [platform / hardware]: [yes / no]
- [ ] Observations: [logs, screenshots, behavior]
- [ ] Linked artefacts: [paths / screenshots / agent-browser sessions]

### Visual evidence (M5 and any UI-touching slice)

- Surface states exercised: [list, e.g. "rail collapsed light, rail expanded dark, dashboard empty, import dialog invalid"]
- Reference parity check: [pass / partial / not yet — link to checkup notes in `docs/moshtty-design-checkup.md`]
- Playwright screenshots updated: [yes / no / N/A]
- `agent-browser` review attached: [yes / no / N/A]

### Stop conditions touched

List every stop-condition path you edited (token files, schema files, IPC contract, AGENTS.md, PRD, milestones, OWNERS, top-level deps, toolchain). For each, name the coordinator approval and the reason.

If you did not touch any stop-condition path, say "None."

### Deferred / follow-up work

- [ ] [Item left for a later slice — link a brief under `docs/agents/followups/` if one exists]
- [ ] [Known visual gap — record under `docs/moshtty-design-checkup.md`]
- [ ] [Test gap — record in PRD risks]

### PRD close-out checklist

- [ ] Milestone status updated in `docs/moshtty-prd.md`
- [ ] Task status updated in `docs/moshtty-prd.md`
- [ ] Verification commands and results recorded
- [ ] Blockers / follow-ups added (or "None")
- [ ] Owner row reflects current state
- [ ] Linked brief is `Ready for review` / `Blocked` / `Verified on target`

### Notes for the next agent

- [Anything that would have saved you an hour of poking around: weird config, flaky test, undocumented assumption, model that worked or didn't, a path the work shouldn't go down.]
```
