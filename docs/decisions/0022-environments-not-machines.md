# 0022. Environments are named, machines are not

- **Status:** Accepted
- **Date:** 2026-09-23

## Context

[ADR 0019](0019-compose-stacks-and-configuration.md) keyed a deployment to
its machine: `env/<host>.env`, `OLYMPUS_HOST`, `stack.sh bootstrap <host>`.
That was true while one machine meant one environment, and it stopped
being true twice over.

- The Mac Mini is not only production. It runs `hasura-dev` over an
  `olympus_dev` database and RabbitMQ's `/dionysus-dev` vhost, which the
  workspace and the laptop work against. Calling the file `mac-mini.env`
  said where it ran rather than what it was.
- The laptop is a development environment. `laptop.env` named the
  hardware, so a second one — or the same work on another machine —
  had nothing to be called.

There is one developer. Dev has never needed a user per service in
RabbitMQ, or isolation between developers' consumers, and pretending
otherwise made the lean local stack that ADR 0019 wanted harder to
arrange than it needed to be.

## Decision

### The name is the environment

`infra/docker/env/<env>.env` and `env/<env>/<service>.env`, with
`OLYMPUS_ENV` in the file and `stack.sh bootstrap <env>` recording it in
`env/.current`. Two exist:

| Environment | Where          | What it is                                                     |
| ----------- | -------------- | -------------------------------------------------------------- |
| `prod`      | the Mac Mini   | The platform as it runs, and the dev resources others point at |
| `local`     | the dev laptop | A development environment, its own stacks or against prod's    |

Prose still says "the Mac Mini" where the machine is the point: nginx
mounts the checkout from it, and the registry runs on it (ADR 0011).

### Dev is resources, not an environment

There is no `dev.env`. Dev is the `hasura-dev` stack, the `olympus_dev`
database and the `/dionysus-dev` vhost, all inside `prod`, and what uses
them is `local` or a service running from the IDE. Dev becomes an
environment of its own the day it needs its own copies of the services;
the Compose project name is fixed at `olympus` today, so that is what
would have to give first.

### Local is a development environment wherever its data lives

Its services connect as one dev user, `olympus-dev`, on `/dionysus-dev`,
whether the broker is its own or the one on prod. Only where the broker
and Hasura live changes between the two:

- `AMQP_PROTOCOL`, `AMQP_HOST`, `AMQP_PORT`, `AMQP_VHOST`,
  `HASURA_PROTOCOL`, `HASURA_HOST` and `HASURA_PORT` are overridable in
  the compose file, with prod's values as the defaults, so prod renders
  exactly as it did before.
- `AMQP_USER_OVERRIDE` replaces every service's own user, and carries the
  password file with it: a user and its password are one choice, and
  splitting them across two settings is how they drift.

Prod keeps a user per service, each allowed only its own vhost. That is
the part of ADR 0019 worth keeping: it is a real boundary in production,
and a courtesy nobody needs in development.

### Certificates name the environment too

A service certificate's OU is where the service runs (ADR 0018), so it
is `prod` rather than `mac-mini`, alongside `nas`. Nothing reads the
value; it identifies a principal in the API's logs.

## Consequences

- Prod's rendered Compose is byte for byte what it was; the rename is a
  marker file and an env file away on that host.
- A third environment is a file and a directory, not a decision.
- Dev messages are not isolated per developer. With one developer that is
  a simplification; with two it becomes a vhost each, and
  `AMQP_USER_OVERRIDE` is where that would be said.
- Where this record and ADR 0019 disagree on what a file is called, this
  one is right; ADR 0019 is otherwise unchanged, as records are.
- The dev CA reissues with `OU=prod` (`scripts/dev-ca.sh --force`), and
  certificates issued from the internal CA (ADR 0020) carry it from here
  on.

## Open

- Whether `local` ever keeps a full stack it can run offline as its
  normal mode, or stays pointed at prod's dev resources with its own
  stacks as the exception.
