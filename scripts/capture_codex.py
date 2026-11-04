#!/usr/bin/env python3
"""Capture a Codex run in a fresh, isolated COPY of the demo fixture.

No automatic publishing. No external API server for visitors.
This uses your local Codex authentication and available usage quota.
"""
from __future__ import annotations
import argparse
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "examples" / "buggy_api"


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run-id", required=True)
    p.add_argument("--max-seconds", type=int, default=180,
                   help="Stop the process after this wall-clock limit (default 180)")
    p.add_argument("--model", help="Optional Codex model override")
    p.add_argument("--prompt-file", type=Path, default=ROOT / "examples" / "prompt.txt",
                   help="Custom local prompt file for strategy experiments")
    args = p.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.run_id):
        p.error("run ID must contain only letters, numbers, hyphens or underscores")
    if not 10 <= args.max_seconds <= 3600:
        p.error("--max-seconds must be between 10 and 3600")
    workspace = ROOT / "data" / "workspaces" / args.run_id
    raw_file = ROOT / "data" / "raw" / f"{args.run_id}.jsonl"
    if workspace.exists() or raw_file.exists():
        p.error("This run ID already exists. Use a fresh ID to preserve reproducibility.")
    workspace.parent.mkdir(parents=True, exist_ok=True)
    raw_file.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(FIXTURE, workspace, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    try:
        prompt = args.prompt_file.read_text(encoding="utf-8")
    except OSError as exc:
        p.error(f"Could not read prompt file: {exc}")
    command = ["codex", "exec", "--json", "--sandbox", "workspace-write",
               "--skip-git-repo-check", "-C", str(workspace)]
    if args.model:
        command += ["--model", args.model]
    command.append(prompt)
    print("Workspace:", workspace)
    print("Raw (PRIVATE) event stream:", raw_file)
    print("This executes Codex using your local account/quota. Ctrl+C to interrupt.", flush=True)
    try:
        with raw_file.open("w", encoding="utf-8") as handle:
            proc = subprocess.run(command, stdout=handle, stderr=None,
                                  timeout=args.max_seconds, check=False)
        print("Codex exit status:", proc.returncode)
        print("Next: normalize, review, and explicitly add the trace to public/traces/index.json")
    except FileNotFoundError:
        raw_file.unlink(missing_ok=True)
        p.error("Codex CLI not found in PATH. Install/login first, then rerun with a new ID.")
    except subprocess.TimeoutExpired:
        print(f"Time limit ({args.max_seconds}s) reached. Partial raw trace remains private.")
    except KeyboardInterrupt:
        print("Interrupted. Partial raw trace remains private.")


if __name__ == "__main__":
    main()
