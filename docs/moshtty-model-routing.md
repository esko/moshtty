# Moshtty Agent Model Routing

## Purpose

Moshtty uses multiple implementation agents. Model choice should match task risk and context size, not habit. This file documents when to use the available `cmd` harness models and when to keep work in the primary Codex session.

## Available External Agent Models

### DeepSeek V4 Pro

Use through the `cmd` harness as `deepseek/deepseek-v4-pro`.

Observed/current positioning:

- NVIDIA's model card describes DeepSeek V4 Pro as a large MoE model with a 1M-token context window and coding-task orientation: <https://build.nvidia.com/deepseek-ai/deepseek-v4-pro/modelcard>
- NIST CAISI published an evaluation of DeepSeek V4 Pro in May 2026, confirming it is an evaluated open-weight model and noting developer-recommended settings such as context length, max tokens, and thinking behavior: <https://www.nist.gov/news-events/news/2026/05/caisi-evaluation-deepseek-v4-pro>

Best fit:

- large-context codebase analysis;
- repo-wide refactor planning;
- architecture review;
- protocol design review;
- migration planning;
- finding cross-cutting inconsistencies across many files;
- second-opinion review before large commits.

Avoid as first choice for:

- small single-file edits;
- quick docs edits;
- routine test fixes;
- tasks where latency matters more than deep context;
- tasks that require very strict local tool/repo feedback loops unless the harness is already proven for that workflow.

Default prompt shape:

```text
Use model deepseek/deepseek-v4-pro. Read AGENTS.md, docs/moshtty-prd.md, docs/moshtty-plan.md, docs/moshtty-milestones.md, docs/moshtty-testing.md, and the assigned task brief. Work only in the assigned write scope. Do not revert other agents' work. Close out the PRD before committing. Use an atomic conventional commit.
```

### Gemini 3.5 Flash

Use through Antigravity/`agy` or equivalent Gemini harness when available.

Observed/current positioning:

- Google's Gemini 3.5 announcement describes 3.5 Flash as generally available through Google Antigravity, Gemini API, AI Studio, Android Studio, and Gemini Enterprise, and as a default model for Gemini app / AI Mode: <https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-5/>
- Google DeepMind publishes the Gemini 3.5 Flash model card and evaluation references: <https://deepmind.google/models/model-cards/gemini-3-5-flash>

Best fit:

- scaffold tasks;
- bounded implementation work with clear file ownership;
- straightforward TypeScript/Go package work;
- docs expansion from existing plans;
- test writing and test repair;
- UI polish tasks with concrete screenshots/design references;
- agentic workflows that need many small tool calls and quick iteration.

Avoid as first choice for:

- huge repo-wide reasoning tasks where 1M-token context materially changes the answer;
- high-risk protocol/security architecture review without follow-up verification;
- final review of large cross-cutting changes unless paired with local verification.

Default prompt shape:

```text
Use Gemini 3.5 Flash. Read AGENTS.md, docs/moshtty-prd.md, docs/moshtty-plan.md, docs/moshtty-milestones.md, docs/moshtty-testing.md, and the assigned task brief. Work only in the assigned write scope. Do not revert other agents' work. Close out the PRD before committing. Use an atomic conventional commit.
```

## Routing Rules

Use the primary Codex session for:

- immediate blocker work on the critical path;
- integrating agent results;
- resolving conflicts;
- committing final coordinated slices;
- tasks that need tight judgment across current user instructions.

Use Gemini 3.5 Flash for:

- first-pass implementation of a well-scoped task brief;
- UI/scaffold/test/doc tasks with explicit acceptance criteria;
- quick follow-up fixes after review;
- tasks where speed and tool iteration matter.

Use DeepSeek V4 Pro for:

- pre-implementation design review;
- large-context audits;
- cross-file architecture consistency checks;
- refactor plans before touching many files;
- transport/security/protocol review.

Do not run both models on the same write scope at the same time. If both are useful, sequence them:

1. DeepSeek V4 Pro reviews or plans the broad problem.
2. Gemini 3.5 Flash implements a bounded slice.
3. Codex integrates, verifies, and resolves issues.

## Required Instructions For Any External Agent

Every external agent must be told:

- it is not alone in the repo;
- it must not revert unrelated changes;
- its write scope;
- the exact task brief;
- the verification commands;
- that it must close out `docs/moshtty-prd.md` before commit;
- that it must use an atomic conventional commit;
- that it must report changed files, tests run, commit hash, and blockers.
- that it must get corrected immediately if it is on the wrong path; orchestrators should stop drift early, narrow the scope, or reassign the slice before additional files change.

## Recommended Task Mapping

| Task type | Preferred model |
| --- | --- |
| Scaffold from clear brief | Gemini 3.5 Flash |
| Electron state shell implementation | Gemini 3.5 Flash |
| macOS remote companion implementation | Gemini 3.5 Flash |
| WebTransport/Mosh mux architecture review | DeepSeek V4 Pro |
| WebTransport/Mosh mux implementation | Codex or Gemini 3.5 Flash after review |
| UI/Ghostty implementation | Gemini 3.5 Flash |
| Visual QA with screenshots | Gemini 3.5 Flash plus agent-browser |
| Large PR review | DeepSeek V4 Pro, then Codex |
| Conflict resolution | Codex |
