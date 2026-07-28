#!/usr/bin/env python3
"""Add complete Paisaxe dynamic-variable fixtures to the 47 live test cases."""

import json
import os
import pathlib
import urllib.error
import urllib.request


VISITOR_AGENT_ID = "agent_1201kgqhsdzxfkk9x7m1bjaew9mv"
BOOKING_AGENT_ID = "agent_5201kgm2956ge8ct95yxjas867z5"
REGISTRY = (
    pathlib.Path(__file__).parent
    / "../docs/agents/paisaxe-test-ids.json"
).resolve()

VISITOR_VARIABLES = {
    "story_title": "Lagos de Covadonga",
    "story_subtitle": "Picos de Europa",
    "story_description": "Lagos glaciares en el Parque Nacional de los Picos de Europa.",
    "story_category": "nature",
    "story_location": "eastern",
    "user_locale": "es-ES",
    "preferred_language": "Spanish",
    "conversation_count": "0",
    "is_returning": "false",
    "time_of_day": "morning",
    "current_time": "10:00",
}

BOOKING_VARIABLES = {
    "customer_name": "Juan García López",
    "customer_phone": "672172393",
    "party_size": "4",
    "date": "hoy",
    "time": "21:00",
    "special_requests": "ninguna",
}


def request(method: str, path: str, body: dict | None = None) -> dict:
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is required.")
    data = json.dumps(body).encode() if body is not None else None
    headers = {"xi-api-key": api_key}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(
        f"https://api.elevenlabs.io{path}",
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as error:
        raise RuntimeError(
            f"ElevenLabs {method} {path} failed ({error.code})."
        ) from error


def update_body(test: dict, variables: dict) -> dict:
    return {
        "type": test["type"],
        "name": test["name"],
        "chat_history": test["chat_history"],
        "dynamic_variables": variables,
        "success_condition": test.get("success_condition", ""),
        "success_examples": test.get("success_examples", []),
        "failure_examples": test.get("failure_examples", []),
    }


def main() -> None:
    registry = json.loads(REGISTRY.read_text())
    updated = 0
    for key, entry in sorted(registry.items()):
        agent_id = entry["agent_id"]
        if agent_id == VISITOR_AGENT_ID:
            variables = VISITOR_VARIABLES
        elif agent_id == BOOKING_AGENT_ID:
            variables = BOOKING_VARIABLES
        else:
            raise RuntimeError(f"Test {key} is assigned to a non-Paisaxe agent.")

        test_id = entry["test_id"]
        live = request("GET", f"/v1/convai/agent-testing/{test_id}")
        request(
            "PUT",
            f"/v1/convai/agent-testing/{test_id}",
            update_body(live, variables),
        )
        readback = request("GET", f"/v1/convai/agent-testing/{test_id}")
        if readback.get("dynamic_variables") != variables:
            raise RuntimeError(f"Dynamic-variable readback failed for {key}.")
        updated += 1
        print(f"{key}: reconciled")

    print(f"Reconciled {updated} Paisaxe tests.")


if __name__ == "__main__":
    main()
