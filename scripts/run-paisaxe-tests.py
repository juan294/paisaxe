#!/usr/bin/env python3
"""
Run Paisaxe automated tests via ElevenLabs Agent Testing.

Usage:
    python3 scripts/run-paisaxe-tests.py                    # run all tests
    python3 scripts/run-paisaxe-tests.py 1.1 1.2 2.3       # run specific tests by ID
    python3 scripts/run-paisaxe-tests.py --section 5        # run entire section 5
    python3 scripts/run-paisaxe-tests.py --section 11       # run Booking Agent tests only

After every run the Last Run section in paisaxe-voice-agent-test-plan.md is overwritten.

DO NOT wire this into pnpm test, CI, pre-commit hooks, or any automated pipeline.
Cost: ~$0.05/min. Run manually when you decide to test.

Exits 0 if all tests pass, 1 if any fail.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
import argparse
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IDS_PATH = os.path.join(SCRIPT_DIR, "../docs/agents/paisaxe-test-ids.json")
PLAN_PATH = os.path.join(SCRIPT_DIR, "../docs/agents/paisaxe-voice-agent-test-plan.md")
PLAN_START = "<!-- LAST-RUN-START -->"
PLAN_END = "<!-- LAST-RUN-END -->"

POLL_INTERVAL_SECS = 4
TIMEOUT_SECS = 300  # 5 minutes

AGENT_ALIASES = {
    "pelayo": "agent_1201kgqhsdzxfkk9x7m1bjaew9mv",
    "booking": "agent_5201kgm2956ge8ct95yxjas867z5",
}


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def api_get(path: str) -> dict:
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set in the environment.")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io{path}",
        headers={"xi-api-key": api_key},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_post(path: str, body: dict) -> dict:
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set in the environment.")
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io{path}",
        data=data,
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": e.read().decode()}


# ---------------------------------------------------------------------------
# Test loading & filtering
# ---------------------------------------------------------------------------

def _sort_key(key: str) -> tuple:
    parts = key.split(".")
    return (int(parts[0]), float(parts[1]) if len(parts) > 1 else 0)


def load_tests(filter_keys: list[str] | None = None) -> list[dict]:
    if not os.path.exists(IDS_PATH):
        print(f"ERROR: {IDS_PATH} not found. Run create-paisaxe-tests.py first.")
        sys.exit(1)
    with open(IDS_PATH) as f:
        registry = json.load(f)
    if not registry:
        print("ERROR: Test ID registry is empty. Run create-paisaxe-tests.py first.")
        sys.exit(1)

    tests = []
    for key, val in registry.items():
        if "test_id" not in val:
            continue
        if filter_keys and key not in filter_keys:
            continue
        tests.append({
            "key": key,
            "test_id": val["test_id"],
            "name": val["name"],
            "agent_id": val.get("agent_id", ""),
        })

    return sorted(tests, key=lambda t: _sort_key(t["key"]))


# ---------------------------------------------------------------------------
# Run & poll
# ---------------------------------------------------------------------------

def run_tests_by_agent(
    tests: list[dict],
    branch_id: str | None = None,
    repeat_count: int = 1,
    batch_size: int | None = None,
) -> list[tuple[str, list[dict]]]:
    """Send tests grouped by agent and bounded batches."""
    by_agent: dict[str, list[dict]] = {}
    for t in tests:
        by_agent.setdefault(t["agent_id"], []).append(t)

    invocations = []
    for agent_id, group in by_agent.items():
        size = batch_size or len(group)
        for offset in range(0, len(group), size):
            batch = group[offset:offset + size]
            print(f"  Sending {len(batch)} tests to agent {agent_id}...")
            payload = {
                "tests": [{"test_id": t["test_id"]} for t in batch],
                **({"branch_id": branch_id} if branch_id else {}),
                **({"repeat_count": repeat_count} if repeat_count != 1 else {}),
            }
            resp = api_post(f"/v1/convai/agents/{agent_id}/run-tests", payload)
            if "error" in resp:
                print(f"  ERROR: {resp['error']}")
                sys.exit(1)
            inv_id = (
                resp.get("id")
                or resp.get("invocation_id")
                or resp.get("test_invocation_id")
            )
            if not inv_id:
                print(f"  ERROR: no invocation ID in response: {resp}")
                sys.exit(1)
            invocations.append((inv_id, batch))
            time.sleep(0.5)

    return invocations


def poll_invocation(invocation_id: str, expected_count: int) -> dict:
    deadline = time.time() + TIMEOUT_SECS
    print(f"  Polling {invocation_id}...")
    while time.time() < deadline:
        try:
            data = api_get(f"/v1/convai/test-invocations/{invocation_id}")
        except Exception as e:
            print(f"  Poll error: {e} — retrying...")
            time.sleep(POLL_INTERVAL_SECS)
            continue
        runs = data.get("test_runs", [])
        done = [r for r in runs if r.get("status") not in ("pending", "running", "queued", None)]
        print(f"  {len(done)}/{len(runs)} complete...", end="\r", flush=True)
        if len(done) >= expected_count and len(runs) > 0:
            print()
            return data
        time.sleep(POLL_INTERVAL_SECS)
    print("\nTimeout waiting for results.")
    return {}


def run_and_poll(
    tests: list[dict],
    branch_id: str | None,
    repeat_count: int,
    batch_size: int | None,
) -> list[tuple[dict, list[dict]]]:
    """Run bounded batches serially so provider concurrency cannot corrupt evidence."""
    if not batch_size:
        invocations = run_tests_by_agent(
            tests,
            branch_id=branch_id,
            repeat_count=repeat_count,
        )
        return [
            (poll_invocation(invocation_id, len(group) * repeat_count), group)
            for invocation_id, group in invocations
        ]

    all_data: list[tuple[dict, list[dict]]] = []
    for offset in range(0, len(tests), batch_size):
        batch = tests[offset:offset + batch_size]
        invocations = run_tests_by_agent(
            batch,
            branch_id=branch_id,
            repeat_count=repeat_count,
        )
        for invocation_id, group in invocations:
            data = poll_invocation(invocation_id, len(group) * repeat_count)
            all_data.append((data, group))
    return all_data


# ---------------------------------------------------------------------------
# Results display
# ---------------------------------------------------------------------------

def _parse_run(run: dict) -> tuple[str, str]:
    """Return (verdict_str, reason_str) from a completed test run."""
    cr = run.get("condition_result") or {}
    result = cr.get("result", "")          # "pass" | "fail" | "unknown"
    rationale = cr.get("rationale") or {}
    summary = rationale.get("summary", "")
    messages = rationale.get("messages", [])
    reason = summary or (messages[0] if messages else "")

    # Fallback: use top-level status when condition_result is absent
    if not result:
        status = run.get("status", "unknown")
        result = "pass" if status in ("passed", "pass") else "fail" if status in ("failed", "fail") else "unknown"

    return result, reason


def _verdict_icon(verdict: str) -> str:
    if verdict in ("pass", "passed", "success"):
        return "PASS"
    if verdict in ("fail", "failed", "failure"):
        return "FAIL"
    return "ERR "


def _flat_sorted(all_data: list[tuple[dict, list[dict]]]) -> list[tuple[dict, dict]]:
    flat: list[tuple[dict, dict]] = []
    for data, tests in all_data:
        id_to_meta = {t["test_id"]: t for t in tests}
        for run in data.get("test_runs", []):
            flat.append((run, id_to_meta.get(run.get("test_id", ""), {})))
    flat.sort(key=lambda x: _sort_key(x[1].get("key", "99.99")))
    return flat


def print_results(all_data: list[tuple[dict, list[dict]]]) -> tuple[int, int, int]:
    passed = failed = errors = 0
    flat = _flat_sorted(all_data)

    print("\n" + "=" * 80)
    print(f"  PAISAXE AGENT TEST RESULTS — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 80)

    for run, meta in flat:
        verdict, reason = _parse_run(run)
        icon = _verdict_icon(verdict)

        if icon == "PASS":
            passed += 1
        elif icon == "FAIL":
            failed += 1
        else:
            errors += 1

        print(f"\n[{meta.get('key', '?')}] {meta.get('name', run.get('test_id', ''))}")
        print(f"  {icon}  |  verdict={verdict}")
        if reason:
            words = reason.split()
            line = "  "
            for w in words:
                if len(line) + len(w) + 1 > 78:
                    print(line)
                    line = "  " + w
                else:
                    line = (line + " " + w) if line.strip() else "  " + w
            if line.strip():
                print(line)

    print("\n" + "=" * 80)
    print(f"  TOTAL: {passed + failed + errors} tests  |  {passed} PASS  |  {failed} FAIL  |  {errors} ERROR")
    print("=" * 80 + "\n")

    return passed, failed, errors


# ---------------------------------------------------------------------------
# Write-back to test plan
# ---------------------------------------------------------------------------

def write_results_to_plan(
    all_data: list[tuple[dict, list[dict]]],
    passed: int,
    failed: int,
    errors: int,
    scope: str,
) -> None:
    if not os.path.exists(PLAN_PATH):
        print(f"Warning: test plan not found at {PLAN_PATH} — results not written.")
        return

    flat = _flat_sorted(all_data)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    total = passed + failed + errors
    verdict_line = "ALL PASS" if failed == 0 and errors == 0 else f"{failed} FAIL  {errors} ERROR"

    lines = [
        f"**{now}** — scope: {scope} — {total} tests — {verdict_line}",
        "",
        "| # | Test | Result | Evaluator note |",
        "|---|------|--------|----------------|",
    ]

    flags: list[tuple[str, str, str]] = []

    for run, meta in flat:
        verdict, reason = _parse_run(run)
        icon = _verdict_icon(verdict)
        key = meta.get("key", "?")
        name = meta.get("name", run.get("test_id", ""))

        if icon == "PASS":
            cell = "PASS"
        else:
            cell = f"**{icon.strip()}**"
            flags.append((key, name, reason or "no result returned"))

        short = (reason[:90] + "…") if len(reason) > 90 else reason
        lines.append(f"| {key} | {name} | {cell} | {short} |")

    if flags:
        lines += ["", "**Needs attention:**", ""]
        for key, name, reason in flags:
            lines.append(f"- **[{key}] {name}**")
            if reason:
                lines.append(f"  - {reason}")

    block = PLAN_START + "\n" + "\n".join(lines) + "\n" + PLAN_END

    with open(PLAN_PATH) as f:
        content = f.read()

    start_idx = content.find(PLAN_START)
    end_idx = content.find(PLAN_END)

    if start_idx == -1 or end_idx == -1:
        print("Warning: LAST-RUN markers not found in test plan — results not written.")
        return

    content = content[:start_idx] + block + content[end_idx + len(PLAN_END):]

    with open(PLAN_PATH, "w") as f:
        f.write(content)

    print(f"Results written to {PLAN_PATH}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the billed Paisaxe ElevenLabs agent test suite."
    )
    parser.add_argument("test_ids", nargs="*", help="Test plan IDs such as 9.1")
    parser.add_argument("--section", help="Run all test IDs in one section")
    parser.add_argument(
        "--agent",
        help="Restrict to pelayo, booking, or an exact Paisaxe agent ID",
    )
    parser.add_argument("--branch", help="Exact ElevenLabs branch ID")
    parser.add_argument("--repeat-count", type=positive_int, default=1)
    parser.add_argument(
        "--batch-size",
        type=positive_int,
        help="Maximum tests per provider invocation.",
    )
    return parser.parse_args(argv)


def main():
    args = parse_args(sys.argv[1:])
    all_tests = load_tests()

    filter_keys: list[str] | None = None
    if args.section:
        filter_keys = [
            t["key"]
            for t in all_tests
            if t["key"].startswith(f"{args.section}.")
        ]
    elif args.test_ids:
        filter_keys = args.test_ids

    tests = load_tests(filter_keys)

    if args.agent:
        agent_id = AGENT_ALIASES.get(args.agent, args.agent)
        owned_ids = {t["agent_id"] for t in all_tests}
        if agent_id not in owned_ids:
            print("ERROR: --agent must resolve to a Paisaxe agent in the test registry.")
            sys.exit(2)
        tests = [test for test in tests if test["agent_id"] == agent_id]

    if not tests:
        print("No tests matched. Check your filter or run create-paisaxe-tests.py.")
        sys.exit(1)

    if args.branch and len({test["agent_id"] for test in tests}) != 1:
        print("ERROR: --branch requires a run scoped to exactly one agent.")
        sys.exit(2)

    scope_parts = []
    if args.section:
        scope_parts.append(f"section {args.section}")
    elif args.test_ids:
        scope_parts.append(", ".join(args.test_ids))
    else:
        scope_parts.append("full suite")
    if args.agent:
        scope_parts.append(f"agent {args.agent}")
    if args.branch:
        scope_parts.append(f"branch {args.branch}")
    if args.repeat_count != 1:
        scope_parts.append(f"repeat {args.repeat_count}")
    if args.batch_size:
        scope_parts.append(f"batch {args.batch_size}")
    scope = " / ".join(scope_parts)

    print(f"\nRunning {len(tests)} Paisaxe tests ({scope})...")
    for t in tests:
        print(f"  [{t['key']}] {t['name']}")

    print()
    print("\nRunning and polling provider invocation(s)...")
    all_data = run_and_poll(
        tests,
        branch_id=args.branch,
        repeat_count=args.repeat_count,
        batch_size=args.batch_size,
    )
    for data, _ in all_data:
        if not data:
            print("No result data returned.")
            sys.exit(1)

    passed, failed, errors = print_results(all_data)
    write_results_to_plan(all_data, passed, failed, errors, scope)

    sys.exit(0 if failed == 0 and errors == 0 else 1)


if __name__ == "__main__":
    main()
