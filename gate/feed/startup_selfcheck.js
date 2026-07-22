'use strict';

const fs = require('fs');
const path = require('path');
const { loadRegistry, routeDoc } = require('./route');

const HERE = __dirname;

function decisionsFor({ fixturesPath, registryPath } = {}) {
  const fixtures = JSON.parse(fs.readFileSync(fixturesPath || path.join(HERE, 'parity_fixtures.json'), 'utf8'));
  const registry = loadRegistry(registryPath || path.join(HERE, 'routing_registry.json'));
  return fixtures.map(fixture => {
    const decision = routeDoc({ ...fixture }, registry);
    return {
      matched_rule: decision.matched_rule,
      destinations: decision.destinations,
      status: decision.status,
    };
  });
}

function registryOrderOk(registryPath) {
  const registry = loadRegistry(registryPath || path.join(HERE, 'routing_registry.json'));
  const period = registry.findIndex(rule => rule.rule_id === 'R-period-expense');
  const expense = registry.findIndex(rule => rule.rule_id === 'R-expense');
  return period !== -1 && expense !== -1 && period < expense;
}

function runFeedStartupSelfCheck(opts = {}) {
  const registryPath = opts.registryPath || path.join(HERE, 'routing_registry.json');
  if (!registryOrderOk(registryPath)) {
    return { ok: false, error: 'routing_registry order invalid: R-period-expense must appear before R-expense' };
  }

  const actual = decisionsFor({ registryPath, fixturesPath: opts.fixturesPath })
    .map(row => JSON.stringify(row))
    .join('\n') + '\n';
  const expectedPath = opts.expectedPath || path.join(HERE, 'parity_expected.jsonl');
  const expected = fs.readFileSync(expectedPath, 'utf8');
  if (actual !== expected) {
    return { ok: false, error: 'routing parity golden mismatch', actual, expected };
  }
  return { ok: true };
}

if (require.main === module) {
  const result = runFeedStartupSelfCheck();
  if (!result.ok) {
    console.error(result.error);
    if (result.expected || result.actual) {
      console.error('--- expected');
      console.error(result.expected || '');
      console.error('--- actual');
      console.error(result.actual || '');
    }
    process.exit(1);
  }
  console.log('PASS: Feed routing startup self-check passed.');
}

module.exports = { runFeedStartupSelfCheck, decisionsFor, registryOrderOk };
