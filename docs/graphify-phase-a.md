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

Generated on 2026-07-25 with `graphify 0.9.26`; refreshed 2026-11-13 with the same commands (adds the Map tab, PIN gate and time-colour code):

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

- Built from source commit: `1d15c1d7462fc80d1d2d8e902d6cd6180b7984b3`
- Nodes: 2,085
- Edges: 5,457
- Communities: 116
- Extraction confidence: all `EXTRACTED` except 13 `INFERRED` edges

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
After the generated artifacts are committed, repository `HEAD` will usually be
one commit newer than the source commit Graphify scanned. Treat the graph as
stale only when maintained app/test source changed after the scanned commit.

If an incremental refresh accidentally pulls stale docs or local cache into the
graph, generate into a fresh temporary output directory and copy only the three
versioned artifacts back:

- `graphify-out/graph.html`
- `graphify-out/graph.json`
- `graphify-out/GRAPH_REPORT.md`
