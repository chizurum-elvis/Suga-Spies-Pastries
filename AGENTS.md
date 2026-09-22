<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:suga-spies-project-rules -->

# Suga Spies project rules

- The project uses root-level `app/`; do not introduce a `src/` directory.
- Before any customer-facing or admin frontend design, implementation, refactor, or visual review, read `skills/pastry-commerce-frontend/SKILL.md` and the references it routes to.
- For current business rules, use `docs/business-owner-discovery-responses.md`, especially **Current authoritative decisions**, when it conflicts with the older PRD.
- Treat this as a pastry-commerce product, not a generic ecommerce, SaaS, or dashboard template. Preserve food-specific art direction, responsive polish, accessibility, performance, and visual verification.

<!-- END:suga-spies-project-rules -->
