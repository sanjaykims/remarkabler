# Graphify Phase A

Phase A is finalized as a code-only Graphify pilot. It is intentionally a
developer artifact, not a runtime feature of Remarkabler.

## What Is Committed

- `graphify-out/graph.html` — browser visualization; open directly in a browser.
- `graphify-out/graph.json` — queryable graph for `graphify query`, `graphify path`, and MCP serving.
- `graphify-out/GRAPH_REPORT.md` — generated summary with god nodes, communities, and suggested questions.
- `.graphifyignore` — keeps extraction focused on maintained app/test source.

Local cache/state files are intentionally ignored:

- `graphify-out/cache/`
- `graphify-out/.graphify_root`
- `graphify-out/.graphify_analysis.json`
- `graphify-out/manifest.json`

Those files contain local paths, mtimes, or cache state and should not be
versioned.

## Generation Command

Generated on 2026-07-25 with `graphify 0.9.25`:

```bash
GRAPHIFY_QUERY_LOG_DISABLE=1 graphify extract . --code-only --max-workers 4
GRAPHIFY_QUERY_LOG_DISABLE=1 graphify cluster-only . --no-label
```

`--code-only` keeps the pass local and avoids sending docs, PDFs, or images to
an LLM. `--no-label` avoids LLM community naming, so community labels remain
`Community N`.

The extraction intentionally excludes `.claude/skills/` and `docs/reference/`
so the graph describes Remarkabler's maintained app/test code rather than
bundled assistant skills or reference projects.

## Current Snapshot

- Built from commit: `f3a4592b4fb6954a93e3bfd1931cf0854e684c82`
- Nodes: 1,407
- Edges: 3,550
- Communities: 104
- Extraction confidence: 3,542 `EXTRACTED`, 8 `INFERRED`

Graphify warned that one JSON/config file produced zero nodes:

- `.claude/settings.json`

That warning is acceptable for this code-only pilot; the file is local assistant
configuration, not a core source module.

## Refreshing

Use the same isolated install pattern if `graphify` is not already available:

```bash
GRAPHIFY_VENV="${TMPDIR:-/tmp}/graphify-phase-a-venv"
python3.14 -m venv "$GRAPHIFY_VENV"
"$GRAPHIFY_VENV/bin/python" -m pip install graphifyy
"$GRAPHIFY_VENV/bin/graphify" extract . --code-only --max-workers 4
"$GRAPHIFY_VENV/bin/graphify" cluster-only . --no-label
```

Then review size/churn before committing the refreshed `graphify-out/` files.
