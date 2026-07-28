import importlib.util
import pathlib
import unittest


SCRIPT_PATH = pathlib.Path(__file__).with_name("reconcile-paisaxe-tests.py")
SPEC = importlib.util.spec_from_file_location("reconcile_paisaxe_tests", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReconcileTests(unittest.TestCase):
    def test_visitor_fixture_covers_every_required_prompt_variable(self):
        expected = {
            "story_title",
            "story_subtitle",
            "story_description",
            "story_category",
            "story_location",
            "user_locale",
            "preferred_language",
            "conversation_count",
            "is_returning",
            "time_of_day",
            "current_time",
        }
        self.assertEqual(set(MODULE.VISITOR_VARIABLES), expected)

    def test_update_body_keeps_test_contract_and_replaces_variables(self):
        live = {
            "id": "test-1",
            "type": "llm",
            "name": "security",
            "chat_history": [{"role": "user", "message": "hello"}],
            "success_condition": "safe",
            "success_examples": [],
            "failure_examples": [],
            "metadata": {"must": "not be sent"},
        }
        body = MODULE.update_body(live, {"story_title": "Covadonga"})
        self.assertNotIn("id", body)
        self.assertNotIn("metadata", body)
        self.assertEqual(body["dynamic_variables"], {"story_title": "Covadonga"})


if __name__ == "__main__":
    unittest.main()
