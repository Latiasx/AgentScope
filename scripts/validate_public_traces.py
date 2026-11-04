#!/usr/bin/env python3
"""Static contract checks for public replay data, intended for CI."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "public" / "traces"
KIND = {"task", "tool", "edit", "message", "warning", "finish"}
STATUS = {"info", "success", "error"}


def main():
    filenames = json.loads((DIRECTORY / "index.json").read_text(encoding="utf-8"))
    assert isinstance(filenames, list) and filenames, "Empty/invalid trace index"
    assert len(filenames) == len(set(filenames)), "Duplicate indexed traces"
    for filename in filenames:
        assert filename.endswith(".json") and "/" not in filename and "\\" not in filename
        data = json.loads((DIRECTORY / filename).read_text(encoding="utf-8"))
        assert data["schemaVersion"] == 1
        for key in ("id", "taskId", "taskTitle", "strategy", "description"):
            assert isinstance(data[key], str) and data[key]
        assert data["source"] in ("illustrative", "recorded")
        assert data["evaluation"]["status"] in ("passed", "failed", "not_run")
        assert isinstance(data["metrics"], dict)
        assert isinstance(data["events"], list) and 0 < len(data["events"]) <= 500
        ids = []
        for event in data["events"]:
            assert event["kind"] in KIND and event["status"] in STATUS
            assert isinstance(event["title"], str) and isinstance(event["detail"], str)
            ids.append(event["id"])
        assert len(ids) == len(set(ids)), "Duplicate event IDs"
        print(f"Validated: {filename} ({len(ids)} events)")
    print("All public trace contracts valid.")


if __name__ == "__main__":
    main()
