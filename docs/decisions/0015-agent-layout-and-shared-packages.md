# 0015. Agent layout and shared service packages

- **Status:** Accepted
- **Date:** 2026-09-19

## Context

The agents were written before ADR 0014 and each carries its own copy of
logging, configuration and RabbitMQ setup, reads `process.env` directly,
and exports its SDK wrappers as module-level singletons. The API
publishes messages whose shapes the agents redeclare: when the
notification agent was imported, the API was sending Synology Chat
messages with `deliveryType` while the agent read `destinationType`, so
every bot message went to the channel webhook. Three more agents are
still to be imported.

## Decision

- Agents follow ADR 0014 with agent-specific parts
  (`docs/conventions/agent.md`): feature folders with `handlers/`,
  injectable SDK wrappers in `api/` behind an `OlympusApiModule`, typed
  and validated configuration, Nest's `Logger`, tests under `test/`, and
  convention checks.
- `packages/nest` (`@ncfritz/olympus-nest`) holds service infrastructure
  every Nest service needs: `EnvReader`, runtime/AMQP/logging config
  readers and the Winston logger. The API and agents use it.
- `packages/messages` (`@ncfritz/olympus-messages`) holds each RabbitMQ
  contract that crosses services: exchange names, routing keys and
  payload types. Publisher and consumers compile against it. Types use
  string unions, not model enums, so agents don't depend on the model.
- Each import brings the agent onto these conventions before its bugs
  are fixed: a behaviour-preserving restructure with tests first, then one
  commit per fix.

## Consequences

- A new agent starts from the notification agent's layout; shared setup
  is a few lines.
- Changing a message contract is a compile error in every consumer
  instead of silently dropped data.
- Convention checks are per agent for now; once a second agent is
  imported they move to a shared test helper.
