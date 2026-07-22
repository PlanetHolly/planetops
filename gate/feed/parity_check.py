#!/usr/bin/env python3
"""Print Python router decisions for shared parity fixtures."""
import json
from pathlib import Path

from brain_router import Fact, load_registry, route


HERE = Path(__file__).resolve().parent


def main():
    with (HERE / "parity_fixtures.json").open("r", encoding="utf-8") as handle:
        fixtures = json.load(handle)

    registry = load_registry(HERE / "routing_registry.json")
    for fixture in fixtures:
        fact = Fact.from_dict(fixture)
        decision = route(fact, registry)
        print(json.dumps({
            "matched_rule": decision.matched_rule,
            "destinations": decision.destinations,
            "status": fact.status,
        }, separators=(",", ":")))


if __name__ == "__main__":
    main()
