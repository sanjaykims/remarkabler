# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (this repo — no monorepo signals found: no `pnpm-workspace.yaml`, no `workspaces` field in `package.json`):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-....md
│   └── 0002-....md
└── (app/, lib/, ...)
```

Neither `CONTEXT.md` nor `docs/adr/` exist yet in this repo as of this setup — that's expected; they're created lazily. This repo already has an established `docs/sessions/*.md` convention for narrative session logs (referenced from `AGENTS.md`/`CLAUDE.md`) — that's a different, complementary thing from `CONTEXT.md`/ADRs: session logs are chronological narrative ("what we decided and why, this session"), while `CONTEXT.md`/ADRs are the standing, current-state domain model and decision record ("what's true now, and why we chose it"). Don't conflate the two or let one substitute for the other.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
