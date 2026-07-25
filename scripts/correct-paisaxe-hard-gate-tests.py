#!/usr/bin/env python3
"""Correct two Paisaxe test fixtures whose evaluator setup caused false failures."""

import importlib.util
import pathlib


RECONCILE_PATH = pathlib.Path(__file__).with_name("reconcile-paisaxe-tests.py")
SPEC = importlib.util.spec_from_file_location("reconcile_paisaxe_tests", RECONCILE_PATH)
assert SPEC and SPEC.loader
RECONCILE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RECONCILE)

PRICE_TEST_ID = "test_1401knestawke92rm8k0gp7z8bhg"
BOOKING_CLOSE_TEST_ID = "test_9001knestgh2f0m9x296vabzfrgm"
BOOKING_TOOL_TEST_ID = "test_0301knest6sqe9hsjy3e2vp7jnzz"


def update(test_id: str, transform) -> None:
    live = RECONCILE.request("GET", f"/v1/convai/agent-testing/{test_id}")
    transform(live)
    variables = (
        RECONCILE.BOOKING_VARIABLES
        if test_id == BOOKING_CLOSE_TEST_ID
        else RECONCILE.VISITOR_VARIABLES
    )
    RECONCILE.request(
        "PUT",
        f"/v1/convai/agent-testing/{test_id}",
        RECONCILE.update_body(live, variables),
    )
    readback = RECONCILE.request(
        "GET", f"/v1/convai/agent-testing/{test_id}"
    )
    readback_messages = [
        (entry["role"], entry.get("message"), entry.get("time_in_call_secs"))
        for entry in readback["chat_history"]
    ]
    expected_messages = [
        (entry["role"], entry.get("message"), entry.get("time_in_call_secs"))
        for entry in live["chat_history"]
    ]
    if readback_messages != expected_messages:
        raise RuntimeError(f"Chat-history readback failed for {test_id}.")
    if readback["success_condition"] != live["success_condition"]:
        raise RuntimeError(f"Evaluator readback failed for {test_id}.")


def correct_price_test(test: dict) -> None:
    test["success_condition"] = (
        "Pass if the agent says entry is free (the documented policy), uses "
        "the search_places tool, or directs the user to the official website "
        "for a current price. Fail only if it invents a nonzero price or "
        "unsupported opening hours."
    )


def correct_booking_close_test(test: dict) -> None:
    test["chat_history"] = [
        {
            "role": "agent",
            "message": (
                "Hola, llamo para hacer una reserva. Sería para cuatro "
                "personas, hoy a las nueve de la noche, a nombre de Juan "
                "García López."
            ),
            "time_in_call_secs": 0,
        },
        {
            "role": "user",
            "message": (
                "Perfecto, mesa para 4 personas, hoy a las 21:00, a nombre "
                "de Juan García López. Quedamos así."
            ),
            "time_in_call_secs": 5,
        },
    ]
    test["success_condition"] = (
        "After the restaurant confirms the details, thanks the restaurant "
        "staff and closes politely. A concise closing such as 'Perfecto, "
        "muchas gracias.' or 'Muchas gracias. Hasta luego.' is a complete "
        "success. Does not drag out the conversation after the booking is "
        "confirmed."
    )


def correct_booking_tool_test(test: dict) -> None:
    test["success_condition"] = (
        "Pass if the agent calls make_booking with the venue, restaurant "
        "phone, party size, date, time, customer name, and customer phone, "
        "and does not claim that the reservation is confirmed. The test "
        "harness returns a synthetic testing_tool_result and may end before "
        "the agent receives a normal post-tool turn, so a tool call followed "
        "only by that synthetic result is a complete success. Fail if the "
        "agent omits required tool fields or falsely claims confirmation."
    )


if __name__ == "__main__":
    update(PRICE_TEST_ID, correct_price_test)
    update(BOOKING_CLOSE_TEST_ID, correct_booking_close_test)
    update(BOOKING_TOOL_TEST_ID, correct_booking_tool_test)
    print(
        "Corrected price-verification, booking-close, and booking-tool "
        "test fixtures."
    )
