#!/usr/bin/env python3
"""PreToolUse gate: no code edit until Graphify has been consulted recently.

Repo rule (CLAUDE.md, owner's standing instruction): query the committed
Graphify graph BEFORE changing code. A rule that depends on remembering gets
skipped, so this makes it automatic: the first code edit (Edit/Write/
MultiEdit/NotebookEdit on a source file) is refused until a
`graphify query|explain|path` has run in this session within the last
TTL minutes (graphify_mark.py records that). Docs, changelog and graph
artifacts are exempt. If graphify isn't installed, it warns instead of
blocking (install steps are in the message), so a broken environment can't
wedge the session.
"""
import json
import os
import re
import shutil
import sys
import time

TTL_SECONDS = 15 * 60
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".sql", ".sh", ".py"}
SKIP_PARTS = ("/node_modules/", "/graphify-out/", "/.next/", "/docs/", "/.claude/", "/.agents/")


def marker_path(session_id: str) -> str:
    base = os.path.join(os.environ.get("TMPDIR", "/tmp"), "remarkabler-graphify")
    return os.path.join(base, "".join(c for c in session_id if c.isalnum() or c in "-_") or "nosession")


# A Bash command that rewrites a code file is an edit too (python/sed/tee/redirect/patch scripts
# used to slip past this gate because it only watched the Edit/Write tools).
BASH_WRITE = re.compile(
    r"(\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\btee\b|\bgit\s+apply\b|\bpatch\b"
    r"|\bcp\b|\bmv\b|\binstall\b|>>?\s*[\w./\"'$-]"
    r"|open\([^)]*['\"](w|a|r\+|wb|ab)['\"]|write_text|write_bytes|writeFileSync|\.write\()"
)
BASH_CODE_PATH = re.compile(r"[\w./\[\]()-]+\.(ts|tsx|js|jsx|mjs|cjs|css|sql|sh|py)\b|docker/cropword")


def bash_edits_code(cmd: str) -> bool:
    if re.search(r"\bgraphify\b\s+(query|explain|path|update)\b", cmd):
        return False
    if not BASH_WRITE.search(cmd):
        return False
    for m in BASH_CODE_PATH.finditer(cmd):
        norm = m.group(0).replace("\\", "/")
        if not any(p in "/" + norm for p in SKIP_PARTS) and not norm.startswith(("/tmp/", "tmp/")):
            return True
    return False


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    tool_input = data.get("tool_input") or {}
    if data.get("tool_name") == "Bash":
        if not bash_edits_code(str(tool_input.get("command") or "")):
            return 0
        path = "bash-command"
        norm = ""
    else:
        path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
        if not path:
            return 0
        norm = path.replace("\\", "/")
        if os.path.splitext(norm)[1].lower() not in CODE_EXT:
            return 0
        if any(p in norm for p in SKIP_PARTS):
            return 0

    venv_bin = os.path.join(os.environ.get("TMPDIR", "/tmp"), "graphify-phase-a-venv", "bin", "graphify")
    if not (shutil.which("graphify") or os.path.exists(venv_bin)):
        sys.stderr.write(
            "graphify is not installed, so the Graphify-first rule cannot be enforced. "
            "Install it per docs/graphify-phase-a.md (isolated venv), then query the graph.\n"
        )
        return 0

    try:
        age = time.time() - os.path.getmtime(marker_path(str(data.get("session_id", ""))))
        if age <= TTL_SECONDS:
            return 0
    except OSError:
        pass

    sys.stderr.write(
        "Blocked by the repo's Graphify-first rule: before changing code, consult the code graph.\n"
        "Run one of these, then retry the edit:\n"
        '  graphify query "where is <feature or behavior> implemented" --graph graphify-out/graph.json\n'
        '  graphify explain "<symbol or concept>" --graph graphify-out/graph.json\n'
        '  graphify path "<source>()" "<target>()" --graph graphify-out/graph.json\n'
        "(The unlock lasts 15 minutes of this session; graphify is a map, so still read the real files.)\n"
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
