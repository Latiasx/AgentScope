#!/usr/bin/env python3
"""Normalize the PUBLIC, observable subset of Codex exec --json events.

By design, this tool NEVER publishes reasoning, command output, full file diffs,
or agent message text. Its output still requires manual inspection before release.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
TOOL_TYPES = {"command_execution", "mcp_tool_call", "web_search"}
ALLOWED_STAGES = {"started", "completed", "updated"}


def clean_text(value: str, limit: int = 200) -> str:
    """Best-effort reduction of obvious PII/secrets; not a security guarantee."""
    value = re.sub(r"sk-[a-zA-Z0-9_-]{10,}", "[REDACTED_KEY]", value)
    value = re.sub(r"(?i)\b(api[_-]?key|password|secret|token)\b\s*[:=]\s*\S+", r"\1=[REDACTED]", value)
    value = re.sub(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", "[REDACTED_EMAIL]", value)
    value = re.sub(r"(?:/Users/|/home/)[^/\\\s]+", "[USER_HOME]", value)
    value = re.sub(r"[A-Za-z]:\\Users\\[^\\\s]+", "[USER_HOME]", value)
    return value[:limit]


def normalize(raw_events: list[dict[str, Any]], *, run_id: str,
              task_title: str, task_id: str, strategy: str, model: str | None,
              include_commands: bool = False) -> dict[str, Any]:
    result_events: list[dict[str, Any]] = []
    tool_ids: set[str] = set()
    usage: dict[str, int] = {}

    def add(kind: str, title: str, detail: str, status: str = "info",
            command: str | None = None) -> None:
        if len(result_events) >= 500:
            return
        ev: dict[str, Any] = {"id": f"e{len(result_events) + 1}", "kind": kind,
                              "title": title, "detail": detail, "status": status}
        if command:
            ev["command"] = clean_text(command)
        result_events.append(ev)

    add("task", "Task started", "Codex started executing the selected task.")

    for raw in raw_events:
        event_type = raw.get("type", "")
        if event_type == "turn.completed":
            values = raw.get("usage") or {}
            for key in ("input_tokens", "output_tokens"):
                if isinstance(values.get(key), (int, float)) and not isinstance(values.get(key), bool):
                    usage[key] = int(values[key])
            add("finish", "Codex turn completed", "The recorded Codex turn ended.", "success")
            continue
        if event_type == "turn.failed":
            add("warning", "Codex turn failed", "The recorded Codex turn did not complete successfully.", "error")
            continue
        if event_type == "error":
            add("warning", "Codex reported an error", "An error event occurred; raw details were excluded.", "error")
            continue
        if not isinstance(event_type, str) or not event_type.startswith("item."):
            continue
        stage = event_type.split(".", 1)[1]
        if stage not in ALLOWED_STAGES or stage == "updated":
            continue
        item = raw.get("item")
        if not isinstance(item, dict):
            continue
        typ = item.get("type")
        if typ in ("reasoning", "agent_message", "plan_update"):
            # Deliberate privacy boundary: don't export messages or internal reasoning.
            if typ == "agent_message" and stage == "completed":
                add("message", "Agent response", "Codex produced a user-facing message; contents withheld.")
            continue
        if typ not in TOOL_TYPES | {"file_change"}:
            continue

        item_id = str(item.get("id", "unknown"))
        if typ in TOOL_TYPES:
            tool_ids.add(item_id)
        is_start = stage == "started"
        kind = "edit" if typ == "file_change" else "tool"
        type_label = {"command_execution": "Shell command", "file_change": "File edit",
                      "mcp_tool_call": "MCP tool call", "web_search": "Web search"}.get(typ, "Tool")
        exit_code = item.get("exit_code")
        status = ("error" if isinstance(exit_code, int) and exit_code != 0
                  else "success" if stage == "completed" else "info")
        if is_start:
            detail = f"{type_label} started."
        elif isinstance(exit_code, int):
            detail = f"{type_label} finished with exit code {exit_code}."
        else:
            detail = f"{type_label} finished."
        command = item.get("command") if include_commands and typ == "command_execution" else None
        if not isinstance(command, str):
            command = None
        add(kind, f"{type_label} {'started' if is_start else 'finished'}", detail, status, command)

    # Some CLI streams lack a completion event; don't infer success.
    if not result_events:
        add("task", "No visible events", "No supported observable events were detected.")
    result: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "id": run_id,
        "taskId": task_id,
        "taskTitle": clean_text(task_title),
        "strategy": clean_text(strategy),
        "description": "Replay of observable Codex execution events. No hidden reasoning or raw outputs included.",
        "source": "recorded",
        "events": result_events,
        "metrics": {"toolCalls": len(tool_ids)},
        "evaluation": {"status": "not_run", "notes": "No independent test outcome has been attached. A completed turn does not imply task success."},
    }
    if model:
        result["model"] = clean_text(model)
    for source, target in (("input_tokens", "inputTokens"), ("output_tokens", "outputTokens")):
        if source in usage:
            result["metrics"][target] = usage[source]
    return result


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    with path.open(encoding="utf-8-sig") as handle:
        for line_no, line in enumerate(handle, 1):
            if not line.strip():
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSONL at line {line_no}: {exc.msg}") from exc
            if isinstance(data, dict):
                events.append(data)
    return events


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Raw Codex JSONL path; keep this private")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--task-id", default="api-validation")
    parser.add_argument("--title", default="Fix the missing-email validation bug")
    parser.add_argument("--strategy", default="Recorded Codex run")
    parser.add_argument("--model", default=None)
    parser.add_argument("--include-commands", action="store_true",
                        help="OPT-IN: commands can contain private data; review output before publishing")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", args.run_id):
        parser.error("--run-id must contain only letters, numbers, dashes or underscores")
    if args.input.resolve() == args.out.resolve():
        parser.error("Input and output paths must differ")
    try:
        data = normalize(read_jsonl(args.input), run_id=args.run_id,
                         task_title=args.title, task_id=args.task_id,
                         strategy=args.strategy, model=args.model,
                         include_commands=args.include_commands)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(data['events'])} public replay events to {args.out}")
    print("REVIEW THE EXPORTED JSON MANUALLY before committing or sharing it.")


if __name__ == "__main__":
    main()
