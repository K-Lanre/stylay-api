# OpenSpec: Apply (Code Mode)

Implement an approved OpenSpec change and keep tasks in sync using Code mode workflow.
<!-- OPENSPEC:START -->
**Guardrails**
- Favor straightforward, minimal implementations first and add complexity only when it is requested or clearly required.
- Keep changes tightly scoped to the requested outcome.
- Refer to `openspec/AGENTS.md` (located inside the `openspec/` directory—run `openspec update` if you don't see it) if you need additional OpenSpec conventions or clarifications.

**Steps**
1. Read `changes/<id>/proposal.md`, `design.md` (if present), and `tasks.md` to confirm scope and acceptance criteria.
2. Work through tasks sequentially, keeping edits minimal and focused on the requested change.
3. Confirm completion before updating statuses—make sure every item in `tasks.md` is finished.
4. Update the checklist after all work is done so each task is marked `- [x]` and reflects reality.
5. Reference `openspec list` or `openspec show <item>` when additional context is required.
6. Use available tools (read_file, apply_diff, write_to_file, etc.) to implement changes step-by-step.
7. After implementation, validate that the code meets the requirements and update task statuses accordingly.
8. If issues arise during implementation, use debugging tools and ask for clarification if needed.

**Reference**
- Use `openspec show <id> --json --deltas-only` if you need additional context from the proposal while implementing.
<!-- OPENSPEC:END -->