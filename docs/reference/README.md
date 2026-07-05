# Vendored reference material — read, don't run

This folder holds two third-party repos vendored **as static reference
material**, not as active Claude Code tooling. Both are real, MIT-licensed
projects for using AI agents with Obsidian vaults:

- [`obsidian-mind`](https://github.com/breferrari/obsidian-mind) — an
  Obsidian vault template giving AI coding agents persistent memory
  (slash commands, subagents, lifecycle hooks, a `brain/` folder).
- [`obsidian-second-brain`](https://github.com/eugeniughelbur/obsidian-second-brain) —
  a Claude Code skill that rewrites Obsidian vault pages as new sources are
  ingested, reconciling contradictions automatically ("your vault compounds
  while you sleep").

## Why they're here but not wired up

Both are full agent frameworks — hooks, subagents, scheduled/background
agents, slash commands — designed to run against a **live Obsidian vault**.
This repository is Remarkabler's own source code, not an Obsidian vault, and
Remarkabler's diary export (`lib/diaryExport.ts` / `lib/diaryExportDb.ts`)
needs to stay the **sole writer** of the diary Markdown files it produces.
`obsidian-second-brain` in particular is designed to auto-rewrite vault
pages on its own schedule — running that against Remarkabler's exported
diary files would fight the app for control of the same files.

So these were copied in **without** their `.claude/` (or `.codex/`,
`.gemini/`, `.shardmind/`) directories — the hook/settings/script files that
would otherwise register lifecycle hooks, subagents, or slash commands for
this repo's Claude Code sessions. What's left is documentation and
reference source only. They will not auto-activate in this repo.

If a specific idea from either (e.g. a particular subagent's prompt, a
hook's approach to reconciling contradictions) is worth adopting, that
should be a deliberate, scoped decision — reviewed and adapted like any
other feature — not a side effect of having these files present.

## What *is* active

[`kepano/obsidian-skills`](https://github.com/kepano/obsidian-skills) is a
genuine Agent Skills repo (no hooks, no automation) and its five skills
(`obsidian-markdown`, `obsidian-bases`, `json-canvas`, `obsidian-cli`,
`defuddle`) are installed normally under `.claude/skills/` — they're
plain syntax/tooling references invocable via the Skill tool, with no
side effects. `.claude/skills/obsidian-skills-LICENSE.md` carries its
license.
