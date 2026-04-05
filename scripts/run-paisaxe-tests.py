#!/usr/bin/env python3
"""
Run Paisaxe automated tests via ElevenLabs Agent Testing.

Usage:
    python3 scripts/run-paisaxe-tests.py                    # run all tests
    python3 scripts/run-paisaxe-tests.py 1.1 1.2 2.3       # run specific tests
    python3 scripts/run-paisaxe-tests.py --section 5        # run entire section 5
    python3 scripts/run-paisaxe-tests.py --section 11       # run Booking Agent tests only

Exits 0 if all tests pass, 1 if any fail.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
API_KEY = os.environ.get("ELEVENLABS_API_KEY", "").strip()
if not API_KEY:
    raise RuntimeError("ELEVENLABS_API_KEY is not set in the environment.")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
IDS_PATH = os.path.join(SCRIPT_DIR, "../docs/agents/paisaxe-test-ids.json")

POLL_INTERVAL_SECS = 4
TIMEOUT_SECS = 300  # 5 minutes


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def api_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.elevenlabs.io{path}",
        headers={"xi-api-key": API_KEY},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_post(path: str, body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io{path}",
        data=data,
        headers={"xi-api-key": API_KEY, "Content-Type": "application/json"},
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

def run_tests(tests: list[dict]) -> str:
    # Group by agent_id — ElevenLabs run-tests endpoint takes a list of test IDs
    # (mixed agents are allowed in one invocation)
    payload = {"tests": [{"test_id": t["test_id"]} for t in tests]}

    # Use the first test's agent_id for the run endpoint
    # (ElevenLabs evaluates each test against its own configured agent)
    agent_id = tests[0]["agent_id"] if tests else ""
    resp = api_post(f"/v1/convai/agents/{agent_id}/run-tests", payload)
    if "error" in resp:
        print(f"ERROR running tests: {resp['error']}")
        sys.exit(1)
    invocation_id = resp.get("id") or resp.get("invocation_id") or resp.get("test_invocation_id")
    if not invocation_id:
        print(f"ERROR: Could not extract invocation ID from response: {resp}")
        sys.exit(1)
    return invocation_id


def run_tests_by_agent(tests: list[dict]) -> list[tuple[str, list[dict]]]:
    """
    Run tests grouped by agent_id. Returns list of (invocation_id, tests_in_group).
    """
    by_agent: dict[str, list[dict]] = {}
    for t in tests:
        by_agent.setdefault(t["agent_id"], []).append(t)

    invocations = []
    for agent_id, group in by_agent.items():
        print(f"  Sending {len(group)} tests for agent {agent_id[:30]}...")
        payload = {"tests": [{"test_id": t["test_id"]} for t in group]}
        resp = api_post(f"/v1/convai/agents/{agent_id}/run-tests", payload)
        if "error" in resp:
            print(f"  ERROR: {resp['error']}")
            sys.exit(1)
        inv_id = resp.get("id") or resp.get("invocation_id") or resp.get("test_invocation_id")
        invocations.append((inv_id, group))
        time.sleep(0.5)
    return invocations


def poll_invocation(invocation_id: str, expected_count: int) -> dict:
    deadline = time.time() + TIMEOUT_SECS
    while time.time() < deadline:
        try:
            data = api_get(f"/v1/convai/test-invocations/{invocation_id}")
        except Exception as e:
            print(f"  Poll error: {e}")
            time.sleep(POLL_INTERVAL_SECS)
            continue
        runs = data.get("test_runs", [])
        done = [r for r in runs if r.get("status") not in ("pending", "running", None)]
        print(f"  {invocation_id[:20]}...  {len(done)}/{len(runs)} complete", end="\r", flush=True)
        if len(done) >= expected_count and len(runs) > 0:
            print()
            return data
        time.sleep(POLL_INTERVAL_SECS)
    print("\nTimeout waiting for results.")
    return {}


# ---------------------------------------------------------------------------
# Results display
# ---------------------------------------------------------------------------

def print_results(all_data: list[tuple[dict, list[dict]]]) -> tuple[int, int]:
    passed = failed = errors = 0
    all_runs = []
    for data, tests in all_data:
        id_to_meta = {t["test_id"]: t for t in tests}
        for run in data.get("test_runs", []):
            all_runs.append((run, id_to_meta))

    print("\n" + "=" * 80)
    print(f"  PAISAXE AGENT TEST RESULTS — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    print("=" * 80)

    # Sort by test key
    def run_sort_key(item):
        run, id_to_meta = item
        tid = run.get("test_id", "")
        meta = id_to_meta.get(tid, {})
        return _sort_key(meta.get("key", "99.99"))

    for run, id_to_meta in sorted(all_runs, key=run_sort_key):
        tid = run.get("test_id", "")
        meta = id_to_meta.get(tid, {})
        verdict = run.get("result", {}).get("verdict", run.get("status", "unknown"))
        reason = run.get("result", {}).get("reason", "")

        if verdict in ("pass", "passed", True):
            icon = "PASS"
            passed += 1
        elif verdict in ("fail", "failed", False):
            icon = "FAIL"
            failed += 1
        else:
            icon = "ERR "
            errors += 1

        key = meta.get("key", "?")
        name = meta.get("name", tid)
        print(f"\n[{key}] {name}")
        print(f"  {icon}  |  verdict={verdict}")
        if reason:
            print(f"  {reason}")

    print("\n" + "=" * 80)
    total = passed + failed + errors
    print(f"  TOTAL: {total} tests  |  {passed} PASS  |  {failed} FAIL  |  {errors} ERROR")
    print("=" * 80 + "\n")
    return passed, failed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args(argv: list[str]) -> list[str] | None:
    """Return list of test keys to run, or None for all tests."""
    if not argv:
        return None
    if "--section" in argv:
        idx = argv.index("--section")
        section = argv[idx + 1]
        all_tests = load_tests()
        return [t["key"] for t in all_tests if t["key"].startswith(f"{section}.")]
    return argv  # explicit test keys


def main():
    filter_keys = parse_args(sys.argv[1:])
    tests = load_tests(filter_keys)

    if not tests:
        print("No tests matched. Check your filter arguments or run create-paisaxe-tests.py.")
        sys.exit(1)

    print(f"\nRunning {len(tests)} Paisaxe tests...")
    invocations = run_tests_by_agent(tests)

    print(f"\nPolling {len(invocations)} invocation(s)...")
    all_data = []
    for inv_id, group in invocations:
        print(f"  Waiting for invocation {inv_id[:30]}...")
        data = poll_invocation(inv_id, len(group))
        all_data.append((data, group))

    passed, failed = print_results(all_data)
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
