---
name: graphify
description: Navigate Remarkabler's committed repository knowledge graph before broad code exploration.
---

# Workflow: Graphify

Use the committed graph first:

```bash
graphify query "where is <feature or behavior> implemented" --graph graphify-out/graph.json
graphify explain "<symbol or concept>" --graph graphify-out/graph.json
graphify path "<source symbol>()" "<target symbol>()" --graph graphify-out/graph.json
```

If `graphify` is not installed, follow the isolated install commands in
`docs/graphify-phase-a.md`.

Use Graphify to pick the files to inspect, then verify behavior in source.
