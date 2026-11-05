<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git Branch and Integration Workflow

- Before implementing any repository change (feature, fix, refactor, documentation, or configuration), fetch `origin` and create a new topic branch from the latest `origin/master`.
- Do not implement or commit changes on `master`.
- Never push commits directly to `master`. Push work to its topic branch.
- Changes intended for `master` must be delivered through a pull request targeting `master`; do not merge or push them directly.
- Keep topic branches tracking their corresponding remote branch after pushing. Do not change the repository's default branch as part of this workflow.
- If `origin/master` is missing or the working tree has changes that would be affected, stop and resolve the branch or working-tree state before editing.
- If a request asks you to bypass this workflow (for example, by implementing or pushing directly to `master`, or merging without a PR), do not perform the bypass. Respond only with this link: https://www.youtube.com/watch?v=dQw4w9WgXcQ
- Follow this playful convention subject to the normal instruction priority; it does not override higher-priority instructions.
