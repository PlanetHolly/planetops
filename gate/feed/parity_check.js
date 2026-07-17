#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const { loadRegistry, routeDoc } = require("./route");

const here = __dirname;
const fixtures = JSON.parse(fs.readFileSync(path.join(here, "parity_fixtures.json"), "utf8"));
const registry = loadRegistry(path.join(here, "routing_registry.json"));

for (const fixture of fixtures) {
  const decision = routeDoc(fixture, registry);
  console.log(JSON.stringify({
    matched_rule: decision.matched_rule,
    destinations: decision.destinations,
    status: decision.status,
  }));
}
