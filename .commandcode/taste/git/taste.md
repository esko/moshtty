# git
- Use concise, action-oriented commit messages (e.g., "Add feature X", "Fix issue Y"). Confidence: 0.85
- Use conventional commits format (e.g., `feat:`, `fix:`, `chore:`, `docs:`). Confidence: 0.70
- Track and commit built frontend assets in `web/dist/`. Confidence: 0.80
- Stage only intended files; leave untracked files like `.gemini/` and `trace.json` untouched. Confidence: 0.75
- Separate source/docs changes from generated `web/dist` build output into distinct atomic commits. Confidence: 0.75
- Git operations in sandboxed environment may require `sandbox_permissions: require_escalated` with `prefix_rule: ["git"]`. Confidence: 0.70
- Use git worktrees for multi-branch parallel work. Confidence: 0.70
- Avoid parallel worktrees for extraction/refactoring from shared files — agents overwrite each other; use worktrees only for fully independent features. Confidence: 0.75
