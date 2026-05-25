# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# bun
- Use bun for package management and running scripts (e.g., `bun run test`, `bun run build`). Confidence: 0.90
- Use `/home/esko/.bun/bin/bun` as the full path to bun binary when needed. Confidence: 0.85

# go
- Run Go tests from the agent directory with `go test ./...`. Confidence: 0.85
- Use `gofmt -w` to format Go code before committing. Confidence: 0.80
- Use `GOCACHE=/tmp/cgt-go-cache go test ./...` when the default Go build cache is on read-only filesystem. Confidence: 0.75

# verification-workflow
- Run verification sequence before committing: tests → build → visual tests → diff check. Confidence: 0.85
- For frontend changes: run `bun run --cwd web test`, then `bun run --cwd web build`, then `bun run test:visual`. Confidence: 0.80
- Check `git diff --check` for whitespace errors before committing. Confidence: 0.75

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
- Use `agy` for implementation tasks, running subagents until token exhaustion. Confidence: 0.85
- Before spawning agy subagents, write detailed implementer briefs as markdown files in `docs/agents/` with Context, Required Behavior, Suggested Implementation Notes, and Validation sections. Confidence: 0.75
- Run agy subagents sequentially (not in parallel) when they touch overlapping files to avoid merge conflicts. Confidence: 0.65
- Include reference screenshot paths and design cues from ChromeOS Downloads (`/mnt/chromeos/MyFiles/Downloads/`) in implementer briefs for visual tasks. Confidence: 0.70

# workflow
- Restart the servers after each implementation. Confidence: 0.70
