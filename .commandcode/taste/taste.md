# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# bun
- Use bun for package management and running scripts (e.g., `bun run test`, `bun run build`). Confidence: 0.90
- Use `/home/esko/.bun/bin/bun` as the full path to bun binary when needed. Confidence: 0.85

# go
See [go/taste.md](go/taste.md)
# verification-workflow
- Run verification sequence before committing: tests → build → visual tests → diff check. Confidence: 0.90
- For frontend changes: run `bun run --cwd web test`, then `bun run --cwd web build`, then `bun run test:visual`. Confidence: 0.80
- Check `git diff --check` for whitespace errors before committing. Confidence: 0.75

# moshtty-desktop-verification
- For Moshtty desktop changes, run the full verification suite before committing: `pnpm --filter @moshtty/desktop typecheck`, `pnpm --filter @moshtty/desktop lint`, `pnpm --filter @moshtty/desktop lint:css`, `pnpm --filter @moshtty/desktop test`, `pnpm --filter @moshtty/desktop build`, `pnpm --filter @moshtty/desktop test:visual`, and `git diff --check`. Confidence: 0.80
- After all other checks pass, run Electron QA via CDP port 9333 with `agent-browser`. Confidence: 0.70

# git
See [git/taste.md](git/taste.md)
# project-structure
- Frontend code lives in `web/` directory using TypeScript and Vite. Confidence: 0.90
- Backend/agent code lives in `agent/` directory using Go. Confidence: 0.90
- Root test command runs both frontend and Go tests. Confidence: 0.80

# documentation
- Document development workflows and conventions in AGENTS.md. Confidence: 0.70

# design
- Prefer minimal, airy layouts with ample whitespace — avoid busy, dense pages. Confidence: 0.85
- Use a two-column layout for the main landing page: spaces on the left, recently closed tabs on the right. Confidence: 0.85

# ai-tooling
See [ai-tooling/taste.md](ai-tooling/taste.md)
# slice-discipline
- Respect the 8-file soft cap and 20-file hard cap from AGENTS.md. Scoping a brief to 6-7 files is preferred to leave headroom. Confidence: 0.70
- List explicit stop-condition paths in subagent briefs — what NOT to edit (shared docs, other agents' packages, design contract, trust boundary). Confidence: 0.70

# git-safety
- Never run `git clean -fd` without first running `git status` to review untracked files. Prefer `git checkout -- .` for reverting only tracked file changes. Confidence: 0.85

# workflow
- Restart the servers after each implementation. Confidence: 0.70

# disaster-recovery
- Never recreate lost files from memory — recover them from VCS (git reflog, other branches), ask the user to restore from backups, or have the original authoring agent redo the work. Memory recreations are lossy approximations that introduce regressions. Confidence: 0.85
- Never change dependency versions during restore operations — keep exact versions from lockfile/package.json. Bumping versions introduces unrelated API breakage that compounds the original problem. Confidence: 0.80
- When relocating files during recovery, verify that imports, test config aliases, and runtime resolution paths still work — a file that compiles in the wrong location can silently break IPC trust boundaries. Confidence: 0.75
