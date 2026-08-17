#!/bin/bash
# SessionStart hook — prepare a fresh Claude Code on the web container.
#
# Two things a fresh container lacks that this repo's own rules assume:
#
#   1. graphify. `.agents/rules/graphify.md` is `trigger: always_on` and tells
#      every coding agent to query `graphify-out/graph.json` BEFORE broad
#      repository exploration. The graph is committed, but the CLI that reads
#      it is not installed anywhere, so that rule was previously impossible to
#      follow in a fresh session.
#   2. node_modules. CLAUDE.md requires `npm run build` (and `npm test` for
#      pure logic) before any task is called done. Neither runs without deps.
#
# Remote-only: local checkouts have their own environments and shouldn't be
# reshaped by a hook.
#
# Both steps are guarded by an existence check, so re-running is a no-op. The
# container is snapshotted after this completes, so the cost is paid once per
# container, not once per session.

set -uo pipefail

# Local machines opt out entirely.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0

# --- 1. graphify -------------------------------------------------------------
# Installed via `uv tool`, which drops executables in ~/.local/bin. Deliberately
# NOT fatal: a missing uv or a PyPI hiccup should degrade the session to
# "explore by reading files" (which works fine), never block it from starting.
if command -v graphify >/dev/null 2>&1; then
  echo "graphify: already installed ($(graphify --version 2>/dev/null))"
elif command -v uv >/dev/null 2>&1; then
  if uv tool install graphifyy; then
    echo "graphify: installed"
  else
    echo "graphify: install failed — continuing without it" >&2
  fi
else
  echo "graphify: uv not available — skipping" >&2
fi

# uv's bin dir is on PATH in the standard image, but persist it for the session
# so the tool is reachable even if that changes.
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -d "$HOME/.local/bin" ]; then
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# --- 2. node dependencies ----------------------------------------------------
# `npm install` (not `ci`) per the container-caching guidance. better-sqlite3
# compiles natively here, so this is the slow half of the hook.
if [ -d node_modules ]; then
  echo "npm: node_modules present — skipping install"
else
  npm install --no-audit --no-fund || {
    echo "npm: install failed — tests and build will not run" >&2
    exit 0
  }
  echo "npm: dependencies installed"
fi
