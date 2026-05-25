# Handoff Template

Fill this and paste it into the commit body or PR description when closing a task brief.

```markdown
## Handoff — [brief filename]

**Model used:** [e.g. Gemini 3.5 Flash, DeepSeek V4 Pro]

**Files changed:**
- path/to/file.ts  (+N / -M)
- path/to/file.go  (+N / -M)

**Tests run:**
- pnpm --filter @moshtty/desktop test  ([PASSED/FAILED], N tests)
- go test ./...  ([PASSED/FAILED])
- pnpm --filter @moshtty/desktop typecheck  ([PASSED/FAILED])
- pnpm --filter @moshtty/desktop build  ([PASSED/FAILED])
- git diff --check  ([PASSED/FAILED])

**Visual evidence:**
- [link or N/A]

**Stop conditions checked:**
- [list any stop condition paths, or N/A]

**PRD status:**
- [milestone] → [Ready for review / Verified on target / Done]
- [task] → [status]
- Verification commands recorded: [yes/no]
- Blockers: [list or None]
- Follow-ups: [list or None]

**Notes:**
- [any important context for the next agent]
```
