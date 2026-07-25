---
trigger: always_on
description: Use the committed Graphify graph before broad Remarkabler code exploration.
---

## Graphify first

This repository has a committed Graphify code graph at `graphify-out/`.

Rules:
- Before broad repository exploration, cross-module debugging, or architecture guessing, run a targeted Graphify query against `graphify-out/graph.json`.
- Prefer `graphify query "<question>"`, `graphify explain "<symbol or concept>"`, and `graphify path "<A>" "<B>"` before opening many files or doing wide searches.
- Treat Graphify as an orientation map, not proof. After it points to likely files or symbols, read the actual source before editing or making claims.
- If maintained app/test source changed after the snapshot's source commit, refresh with the code-only workflow in `docs/graphify-phase-a.md`.
- Do not use Graphify for runtime diary/user queries. It is a developer navigation artifact only.
