import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from normalize_codex import clean_text, normalize, read_jsonl


class NormalizerTests(unittest.TestCase):
    def test_discards_reasoning_private_text_and_raw_outputs(self):
        raw = [
            {"type": "item.completed", "item": {"id": "1", "type": "reasoning", "text": "SECRET_REASONING"}},
            {"type": "item.started", "item": {"id": "2", "type": "command_execution", "command": "echo PRIVATE_COMMAND"}},
            {"type": "item.completed", "item": {"id": "2", "type": "command_execution", "aggregated_output": "PRIVATE_OUTPUT", "exit_code": 0}},
            {"type": "item.completed", "item": {"id": "3", "type": "agent_message", "text": "PRIVATE_MESSAGE"}},
            {"type": "turn.completed", "usage": {"input_tokens": 1234, "output_tokens": 45}}
        ]
        out = normalize(raw, run_id="run1", task_title="Demo", task_id="a", strategy="S", model=None)
        exported = json.dumps(out)
        for secret in ("SECRET_REASONING", "PRIVATE_COMMAND", "PRIVATE_OUTPUT", "PRIVATE_MESSAGE"):
            self.assertNotIn(secret, exported)
        self.assertEqual(out["metrics"]["toolCalls"], 1)
        self.assertEqual(out["metrics"]["inputTokens"], 1234)
        self.assertEqual(out["evaluation"]["status"], "not_run")

    def test_failed_command_and_failed_turn(self):
        raw = [
            {"type": "item.completed", "item": {"id": "x", "type": "command_execution", "exit_code": 1}},
            {"type": "turn.failed"}
        ]
        out = normalize(raw, run_id="fail", task_title="Fail", task_id="x", strategy="S", model=None)
        self.assertEqual(out["events"][-1]["status"], "error")
        self.assertIn("exit code 1", out["events"][1]["detail"])

    def test_redacts_obvious_personal_paths(self):
        self.assertNotIn("alice", clean_text("/Users/alice/project"))
        self.assertNotIn("bob@example.com", clean_text("bob@example.com"))
        self.assertNotIn("sk-abcdefghijklmnop", clean_text("sk-abcdefghijklmnop"))

    def test_jsonl_read_and_demo_validity(self):
        for file in (ROOT / "public" / "traces").glob("demo-*.json"):
            trace = json.loads(file.read_text(encoding="utf-8"))
            self.assertEqual(trace["schemaVersion"], 1)
            self.assertTrue(trace["events"])
        # The JSONL reader works with Codex's line-separated format.
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as d:
            f = Path(d) / "event.jsonl"
            f.write_text('{"type":"turn.started"}\n{"type":"turn.completed"}\n', encoding="utf-8")
            self.assertEqual(len(read_jsonl(f)), 2)


if __name__ == "__main__":
    unittest.main()
