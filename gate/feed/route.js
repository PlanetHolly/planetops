const fs = require("fs");
const path = require("path");

const REGISTRY_DEFAULT = path.join(__dirname, "routing_registry.json");

function loadRegistry(registryPath = REGISTRY_DEFAULT) {
  const payload = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  return payload.rules || [];
}

function nestedGet(obj, dotted) {
  let current = obj;
  for (const part of dotted.split(".")) {
    if (current && typeof current === "object") {
      current = current[part];
    } else {
      current = undefined;
    }
    if (current === null || current === undefined) {
      return null;
    }
  }
  return current;
}

function nonEmpty(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0) &&
    !(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
  );
}

function valueMatches(values, actual) {
  values = values || [];
  return values.includes("*") || (actual !== null && actual !== undefined ? values.includes(actual) : false);
}

function noteMatches(keywords, note) {
  keywords = keywords || [];
  if (keywords.includes("*")) {
    return true;
  }
  const text = (note || "").toLowerCase();
  return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
}

function ruleMatches(rule, fact) {
  const match = rule.match || {};
  return valueMatches(match.doc_type, fact.doc_type) || noteMatches(match.note_keywords, fact.note);
}

function routeDoc(fact, registry) {
  registry = registry || loadRegistry();
  if (!Array.isArray(registry) && registry.rules) {
    registry = registry.rules;
  }
  fact = fact || {};

  let fallback = null;
  let selected = null;
  for (const rule of registry) {
    if (rule.rule_id === "R-fallback") {
      fallback = rule;
      continue;
    }
    if (ruleMatches(rule, fact)) {
      selected = rule;
      break;
    }
  }
  if (selected === null) {
    selected = fallback || { rule_id: "R-fallback", destinations: ["review"], required_fields: [] };
  }

  const missing = (selected.required_fields || []).filter((field) => !nonEmpty(nestedGet(fact, field)));
  let decision;
  let status;
  if (missing.length) {
    const reason = `missing required fields: ${missing.join(", ")}`;
    decision = {
      matched_rule: `${selected.rule_id} (${reason})`,
      destinations: ["review", "ledger"],
      reason,
    };
    status = "review";
  } else {
    const destinations = [...(selected.destinations || [])];
    if (!destinations.includes("ledger")) {
      destinations.push("ledger");
    }
    decision = {
      matched_rule: selected.rule_id,
      destinations,
      reason: "",
    };
    status = destinations.includes("review") ? "review" : "routed";
  }

  fact.status = status;
  fact.routing = { matched_rule: decision.matched_rule, destinations: decision.destinations };
  return { ...decision, status };
}

module.exports = {
  loadRegistry,
  nestedGet,
  nested_get: nestedGet,
  nonEmpty,
  non_empty: nonEmpty,
  valueMatches,
  value_matches: valueMatches,
  noteMatches,
  note_matches: noteMatches,
  ruleMatches,
  rule_matches: ruleMatches,
  routeDoc,
};
