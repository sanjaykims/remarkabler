#!/usr/bin/env python3
"""PostToolUse(Bash): record that Graphify was consulted (unlocks graphify_gate.py)."""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from graphify_gate import marker_path  # noqa: E402


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    cmd = (data.get("tool_input") or {}).get("command") or ""
    if not re.search(r"\bgraphify\b\s+(query|explain|path)\b", cmd):
        return 0
    m = marker_path(str(data.get("session_id", "")))
    os.makedirs(os.path.dirname(m), exist_ok=True)
    with open(m, "w") as f:
        f.write("1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
