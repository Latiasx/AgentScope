# AgentScope — v0.1 starter

An **interactive, static replay interface** for recorded AI agent actions. This is a working starter for a developer project, not a production benchmark.

**Already implemented:**

- Responsive React/TypeScript workbench with a custom animated CSS robot
- Two clearly labelled *illustrative* runs of one debugging scenario
- Step/skip/replay/speed controls and clickable execution timeline
- Token/tool/time inspector and side-by-side strategy comparison
- Import/export normalized replay JSON directly in the browser
- Python parser for Codex CLI `exec --json` streams
- Example buggy fixture, bounded local Codex capture helper, contract tests and GitHub Actions build checks

**Not implemented yet:** actual Codex recordings, independent benchmark outcomes for imported runs, reproducible repeated-run statistics, a hosted backend, or a live agent. All demo metrics are invented examples and labelled illustrative.

## Start the website

Requires Node.js 20.19+ or 22.12+ and npm (as per Vite compatibility docs).

```bash
npm install
npm run dev
```

Open the local URL Vite prints, generally `http://localhost:5173`.

To run checks:

```bash
python -m unittest discover -s tests -v
python scripts/validate_public_traces.py
npm run build
```

## Capture your first **real** Codex run

You'll need Codex CLI installed, authenticated and accessible from your shell (`codex --version` should work). **Local Codex execution consumes whatever usage/quota your account provides**; the public website doesn't invoke it. Do not upload personal repository content into a public fixture.

The controlled example is `examples/buggy_api/` and contains a deliberately failing test for a missing-email input. The script automatically copies it to a new private workspace to avoid contaminating subsequent experiments.

From the repository root:

```bash
# Check the fixture before invoking Codex (test_missing_email initially fails)
cd examples/buggy_api
python -m unittest -v
cd ../..

# Run Codex on a fresh copy; default time limit 180 seconds
python scripts/capture_codex.py --run-id first-test --prompt-file examples/prompt-test-first.txt

# Convert raw JSONL to a restricted, public replay JSON
python scripts/normalize_codex.py data/raw/first-test.jsonl --run-id first-test --task-id api-validation --title "Fix missing-email validation" --strategy "Focused debugging" --out public/traces/first-test.json --model "your-model-name"
```

You can run the same commands from PowerShell, Git Bash, macOS Terminal or Linux as long as Python and Codex are on PATH. On Windows you may need `py` in place of `python`.

### Add the run to the site

1. **Open `public/traces/first-test.json` and review every field.** Even restricted exports should be checked for secrets, private paths, proprietary code or personal data. This is not a privacy guarantee.
2. Edit `public/traces/index.json` to add `"first-test.json"` as an array entry. (Alternatively, use **Import your own trace** and keep the file local to your browser session.)
3. Run `python scripts/validate_public_traces.py`, then restart the development server or reload the page.
4. For the first comparison, capture another fresh run with `--prompt-file examples/prompt-direct.txt` and a different `--run-id`. Keep the task fixture and model fixed so only prompting strategy changes. You should independently run the fixture tests after each capture before reporting task success.

### Test the importer without using Codex

```bash
python scripts/normalize_codex.py examples/sample-codex.jsonl --run-id imported-sample --out public/traces/imported-sample.json
```

This produces an *example* normalized trace from a synthetic JSONL stream; do not mistake it for a real Codex run. You can import it from the browser without changing the public index.

### What the recorder includes

The normalizer exports only a *restricted subset* of observable events: tool starts/completions, file-edit lifecycle events, error markers, completion marker and turn token usage (where available). By default it deliberately excludes reasoning, message text, raw command output and file diffs. Optional `--include-commands` makes commands visible **but raises privacy risk** and should only be used on a controlled public fixture, followed by manual review.

Importing a normalized trace does not mean an agent solved its task. The default independent evaluation status is `not_run` until you add a separate test runner and verified outcome.

The capture helper applies `--sandbox workspace-write` to the disposable example workspace, and defaults to a 180-second wall-time cap. This does not guarantee a fixed token or account cost; monitor your usage separately. **Never use `danger-full-access` for this fixture.**

## Architecture

```text
examples/buggy_api  -->  scripts/capture_codex.py  --> data/raw/*.jsonl (PRIVATE)
                                         |
                                         v
                           scripts/normalize_codex.py
                                         |
                                         v
                   public/traces/*.json (REVIEWED, PUBLIC)
                                         |
                                         v
                              React replay workbench
```

The normalizer is deliberately a small Python stdlib utility: easy to debug and test, with no backend service. CI validates the trace contracts and builds the frontend; it **never runs Codex or consumes model quota**.

## First useful contributions

1. Build an **independent test harness** that copies fixture files, runs tests and stores verified results alongside traces.
2. Capture 3 runs of the same task under controlled settings; add a small reliability and efficiency comparison.
3. Expand normalized event extraction carefully (annotated summaries and optional sanitized outputs) without exposing internal reasoning.
4. Polish replay UX based on visitor feedback before adding more agents.

## Important limitations

- This is a replay site, not a general-purpose prompt interface.
- Both built-in traces are **hand-authored demos**, not recorded Codex runs.
- Durations in raw Codex JSONL may not be present; the importer leaves unknown metrics unset rather than fabricating them.
- Browser file import stays in memory and does not upload the file to a server.
- Google Fonts are optional; fallback system fonts work without network access.

## Sources / references

- Codex CLI non-interactive JSONL mode: https://learn.chatgpt.com/docs/non-interactive-mode
- Codex CLI options: https://learn.chatgpt.com/docs/cli/reference
- Vite guide: https://vite.dev/guide/
