import importlib.util
import pathlib
import unittest
from unittest.mock import patch


SCRIPT_PATH = pathlib.Path(__file__).with_name("run-paisaxe-tests.py")
SPEC = importlib.util.spec_from_file_location("run_paisaxe_tests", SCRIPT_PATH)
assert SPEC and SPEC.loader
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


class ParseArgsTests(unittest.TestCase):
    def test_accepts_agent_branch_and_repeat_count(self):
        args = RUNNER.parse_args(
            [
                "--agent",
                "pelayo",
                "--branch",
                "agtbrch_test",
                "--repeat-count",
                "3",
                "--batch-size",
                "1",
                "--section",
                "9",
            ]
        )

        self.assertEqual(args.agent, "pelayo")
        self.assertEqual(args.branch, "agtbrch_test")
        self.assertEqual(args.repeat_count, 3)
        self.assertEqual(args.batch_size, 1)
        self.assertEqual(args.section, "9")

    def test_rejects_non_positive_repeat_count(self):
        with self.assertRaises(SystemExit):
            RUNNER.parse_args(["--repeat-count", "0"])


class PayloadTests(unittest.TestCase):
    @patch.object(RUNNER.time, "sleep")
    @patch.object(RUNNER, "api_post")
    def test_scoped_branch_and_repeat_are_sent_to_provider(self, api_post, _sleep):
        api_post.return_value = {"id": "invocation-1"}
        tests = [
            {
                "key": "9.1",
                "test_id": "test-1",
                "name": "security",
                "agent_id": "agent-1",
            }
        ]

        RUNNER.run_tests_by_agent(
            tests, branch_id="agtbrch_test", repeat_count=3
        )

        api_post.assert_called_once_with(
            "/v1/convai/agents/agent-1/run-tests",
            {
                "tests": [{"test_id": "test-1"}],
                "branch_id": "agtbrch_test",
                "repeat_count": 3,
            },
        )

    @patch.object(RUNNER.time, "sleep")
    @patch.object(RUNNER, "api_post")
    def test_batches_tests_to_avoid_provider_saturation(self, api_post, _sleep):
        api_post.side_effect = [{"id": "invocation-1"}, {"id": "invocation-2"}]
        tests = [
            {
                "key": f"9.{index}",
                "test_id": f"test-{index}",
                "name": "security",
                "agent_id": "agent-1",
            }
            for index in (1, 2)
        ]

        invocations = RUNNER.run_tests_by_agent(
            tests,
            branch_id="agtbrch_test",
            repeat_count=3,
            batch_size=1,
        )

        self.assertEqual(
            [invocation_id for invocation_id, _ in invocations],
            ["invocation-1", "invocation-2"],
        )
        self.assertEqual(api_post.call_count, 2)

    @patch.object(RUNNER, "poll_invocation")
    @patch.object(RUNNER, "run_tests_by_agent")
    def test_serial_batches_are_polled_before_next_submission(
        self,
        run_tests,
        poll_invocation,
    ):
        tests = [
            {
                "key": f"9.{index}",
                "test_id": f"test-{index}",
                "name": "security",
                "agent_id": "agent-1",
            }
            for index in (1, 2)
        ]
        events = []

        def submit(batch, **_kwargs):
            events.append(f"submit-{batch[0]['test_id']}")
            return [(f"invocation-{batch[0]['test_id']}", batch)]

        def poll(invocation_id, _count):
            events.append(f"poll-{invocation_id}")
            return {"test_runs": []}

        run_tests.side_effect = submit
        poll_invocation.side_effect = poll

        RUNNER.run_and_poll(tests, "agtbrch_test", 3, 1)

        self.assertEqual(
            events,
            [
                "submit-test-1",
                "poll-invocation-test-1",
                "submit-test-2",
                "poll-invocation-test-2",
            ],
        )


if __name__ == "__main__":
    unittest.main()
