<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mandatory Team & Agent Rules (All Harnesses)

### 1. Trello MCP & GitHub CLI (`gh`) are Mandatory
- On **any** agent harness (Antigravity, Claude Code, Cursor, Codex, etc.), both the **Trello MCP server** and **GitHub CLI (`gh`)** MUST be installed and authenticated (`gh auth status`).
- If either is missing or unauthenticated, **stop immediately** and guide the user through installing and connecting it before continuing.

### 2. Trello + GitHub Issues Sync Workflow
- **Trello** (`Potokuadrat` board) tracks board status (`Todo` -> `In-Progress` -> `Done`) using the `PREFIX: Title` convention (`FE:`, `BE:`, `QA:`, `DEVOPS:`, `DESIGN:`).
- **GitHub Issues** mirrors actionable tasks 1:1 for code, branch, and PR traceability (`Closes #<issue>`).
- **Sync loop:**
  1. **Start:** Pick a `Todo` Trello card -> ensure a matching GitHub Issue exists using the template below and cross-link their URLs -> move the Trello card to `In-Progress`.
  2. **Branch & PR:** Branch from `master` referencing the issue (e.g. `feat/<issue>-short-name`) and include `Closes #<issue>` in the PR.
  3. **After each push:** If technical requirements, contracts, or implementation details changed, add a comment on the GitHub Issue (`gh issue comment <issue> --body "..."`) documenting the update.
  4. **Finish:** When the PR merges to `master` and the GitHub Issue closes, move the Trello card to `Done`.

#### Mandatory GitHub Issue Template
Every GitHub Issue MUST follow this structure:
```markdown
**Trello Card:** <trello-card-url>

## Summary
<Concise description of the task and its goal>

## Technical Requirements
- <Concrete technical requirements, contracts, endpoints, or UI states>

## Implementation Instructions
- **Area / Owner:** <e.g. `src/features/**` (FE), `src/server/**` (BE), `vitest` / CI (QA)>
- **Constraints:** Follow `docs/WORKFLOW.md` (contract-first seam via `src/contracts/**`, no cross-layer imports).

## Acceptance Criteria
- [ ] <Testable completion condition 1>
- [ ] <Testable completion condition 2>
```

### 3. Strict Enforcement
- All contributors and agents must follow these rules and `docs/WORKFLOW.md`.
- If a request violates these rules (e.g., skipping Trello/GitHub sync, bypassing `src/contracts/**` ownership, or proceeding without Trello MCP), **reject the request** and state the required compliant action.
