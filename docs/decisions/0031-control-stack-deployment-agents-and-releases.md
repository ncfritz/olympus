# 0031. Control in a stack of its own, deployment agents, and releases instead of a checkout

- **Status:** Proposed
- **Date:** 2026-10-08

## Context

[ADR 0021](0021-control-host-and-console-navigation.md) put a deployment
console on Olympus Control's sidebar and left it unbuilt. Deploying today
is done by hand, across two machines:

1. On the laptop, `stack.sh build --push --env prod <stack>` builds at
   `HEAD` and pushes to the registry on the Mac Mini, despite
   [ADR 0011](0011-centralized-docker-builds.md) placing builds on the
   Mac Mini.
2. The new tag is committed to `env/prod.env` ("Updating prod Olympus
   image ID") and pushed.
3. On the Mac Mini, `git pull`, then `stack.sh up` (which runs `check`
   first).

The checkout on the Mac Mini exists only for step 3: `stack.sh`, the
compose and env files, `check.mjs`, and the nginx server blocks that the
nginx stack mounts from it. Nothing is ever changed there.

Moving that into a console, Neil asked (2026-10-08) whether it creates a
chicken-and-egg problem. It does, in three places:

- **Control runs inside what it deploys.** The index (`olympus-control`)
  and the Minerva console are services in the `olympus` stack. A
  deployment console there would recreate its own Compose project halfway
  through a deploy, and a bad release would take down the tool for rolling
  it back.
- **Sign-in goes through the API.**
  [ADR 0029](0029-minerva-availability.md) made consoles clients of the
  Olympus API's sign-in. A broken API would lock the operator out of the
  console that fixes it.
- **Control's certificates come from Olympus.** Once the internal CA
  ([ADR 0020](0020-internal-certificate-authority.md), Harpocrates) issues
  and renews them, renewing them depends on Olympus being up.

What Neil wants from the console (2026-10-08):

1. Branches: view them, merge, and so on.
2. Start Docker builds.
3. Show what the registry holds.
4. Find image tags nothing uses, and prune them.
5. Deploy everything, one stack, or one container.
6. Key metrics beside every section.
7. Client and service certificates, with reissue, revoke, and so on.
8. A view of the dev stack.
9. The checks `stack.sh` does now.
10. Local dev processes (pnpm dev servers, builds): start, stop, build,
    and logs.

Scope is Olympus only. Other stacks may come later, but not now.

## Decision

### Split by what must survive a broken Olympus

The rule is not "deployment goes in Control". It is: whatever has to
keep working while Olympus is down must not depend on Olympus. That set
is small:

- the shell and the deployment console;
- the agent that runs deploys;
- a way to sign in;
- the record of releases, so there is something to roll back to;
- Control's own certificates.

Everything else stays an Olympus feature. Control shows it, and shows it
as unavailable when Olympus is down.

### Control is a stack of its own

A fifth Compose project, `compose/control.yml`, beside the four of
[ADR 0019](0019-compose-stacks-and-configuration.md):

| Service                      | What it is                                                            |
| ---------------------------- | --------------------------------------------------------------------- |
| `olympus-control`            | The index at `/`, moved out of `olympus.yml`                          |
| `olympus-deployment-console` | The deployment console at `/olympus/deployment` (ADR 0021)            |
| `olympus-deployment-agent`   | The primary agent: the console's API, and the only thing that deploys |

The console and agent follow [ADR 0016](0016-agents-with-a-management-console.md)
as `agents/olympus-deployment/{agent,console}`, and use ADR 0021's names
and paths.

- **The `olympus` stack never contains Control.** Deploying it, even
  `down` and `up`, leaves Control running. The `control` stack is not in
  any environment's `STACKS`, so a plain `stack.sh up` does not touch it
  either.
- **Control is deployed by `stack.sh` alone**, by hand and rarely:
  `stack.sh up control`. It is the one thing the deployment console does
  not deploy.
- **The agent depends on nothing in Olympus.** It has no RabbitMQ,
  Hasura or API dependency. Its store is SQLite on its own volume
  (`${DATA_DIR}/olympus/agents/olympus-deployment`), with tables and
  columns (ADR 0007) and audit columns on every table.
- **The other consoles stay where they are.** The Minerva calendar
  console, the CA console and anything else that belongs to a feature
  keeps deploying with its feature. nginx routes their paths under the
  Control host as now, the shell lists them from `CONTROL_CONSOLES`, and a
  console that does not answer shows as unavailable rather than failing
  the page.
- **The navigation registry can drift.** ADR 0021 compiled it into every
  console because they all deployed at one tag. Control now deploys at
  its own tag, so adding or renaming a console means redeploying the
  `control` stack too. That is acceptable at this rate of change. ADR
  0021's Open question, whether to fetch the registry at runtime, is
  where this would be revisited.

### Signing in

- **Normally through Olympus**, as ADR 0029 has every console do: an
  Olympus access token with the `admin` role.
- **Break-glass when the API cannot be reached.** A local credential in
  the `control` stack's secrets, checked by the agent alone, offered only
  when the API's sign-in does not answer. Its sessions are short, and
  every use is in the audit log.

### Agents: one primary, others that dial in

| Agent           | Runs on        | How                     | Can                                                                                          |
| --------------- | -------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| Primary, `prod` | the Mac Mini   | In the `control` stack  | Deploy, the registry, prune, checks, prod's Docker; holds releases and the audit log         |
| `local`         | the dev laptop | Natively, not in Docker | Git in the dev checkout (branches, merge), builds, local dev processes, local Docker, checks |
| (none)          | the NAS        | Driven by the primary   | The asset agent's container, through the NAS's Docker over SSH                               |

- **The console talks only to the primary**, as ADR 0016 has a console
  talk only to its own agent. The primary relays to the others.
- **Remote agents dial out** to the primary on one LAN port, over mTLS.
  Each presents a client certificate named by the conventions
  (`olympus-deployment-agent`, OU its environment). A laptop that is
  asleep or away shows as offline, not as a failure, and work sent to it
  waits.
- **Each agent declares what it can do**, and refuses anything else. The
  console disables the controls an agent will not accept. Prod has no
  checkout and declares no git operations.
- The local agent runs outside Docker because it supervises processes
  in the dev checkout and works with the laptop's git and credentials.
- **The NAS runs no agent** (Neil, 2026-10-08). The primary drives its
  Docker the way `stack.sh` does with `DOCKER_CONTEXT`: the Docker API
  over SSH, with a key of its own in the `control` stack's secrets and
  `compose/nas.yml` from the release. What `stack.sh check` cannot see
  from another machine (secret files, bind-mount sources), the primary
  checks with a short-lived container on the NAS that mounts the paths
  read-only and reports what it finds, then exits. Nothing stays
  running there but the asset agent.
- Agents are named by environment ([ADR 0022](0022-environments-not-machines.md)),
  not by machine.

### Builds run on the laptop, from a pushed commit

- **The `local` agent is the builder.** It builds a commit that has been
  pushed, in a clean worktree of its own, never in the working tree. It
  uses `docker buildx bake` and `docker-bake.hcl`, as `stack.sh build
--push --env prod` does now. This keeps `stack.sh`'s rule that a tag
  means a clean commit, without asking the developer to commit first.
- **The Mac Mini is the fallback builder** (Neil, 2026-10-08). The
  primary declares the same build capability, used when the laptop is
  offline or when chosen. It builds natively, competing with prod for CPU,
  and loads straight into the local image store as `stack.sh build
--load` does there. The NAS's amd64 image is the exception, since it
  must be pushed.
- **This amends ADR 0011.** Builds run on the laptop, not the Mac Mini.
  The rest of ADR 0011 still applies: bake, native `$BUILDPLATFORM`
  stages, the amd64 runtime stage for the NAS, and the registry. The
  laptop and the Mac Mini are both arm64, so only the NAS's runtime stage
  crosses architectures.
- A Raspberry Pi build cluster was considered and rejected. The Pi 3Bs
  have 1 GB each, too little for the Next.js builds, and an amd64 image
  under emulation on them would be unusable.

### Releases replace the prod checkout

A **release** is:

- the commit;
- the image tag of every service it deploys;
- a **bundle**: `infra/docker` as of that commit, meaning the compose
  files, env files, `stack.sh`, `check.mjs`, the RabbitMQ definitions
  script and the nginx server blocks.

The builder pushes the bundle to the registry beside the images as a
small image of its own, `olympus/release:<commit>` (`FROM scratch`, the
files and nothing else; Neil, 2026-10-08). Nothing new is needed to fetch
it: `docker pull`, `docker create` and `docker cp`, which the agent,
`stack.sh` and an operator by hand can all do. The registry lists it and
prunes it like any other tag. The primary unpacks each release it deploys
into `${DATA_DIR}/olympus/agents/olympus-deployment/releases/<commit>` and
points `current` at the one running.

**A release is kept only while it is in use** (Neil, 2026-10-08): while it
runs in some environment, or while a deploy that replaces it has not yet
passed its health gates. After that its directory is removed and its tags
become prunable. The **deployment log** keeps what was deployed where and
when, which is enough to go back to. Rolling back to a release that is
gone means pulling it again if its images are still in the registry, and
rebuilding it from its commit if they are not.

- **`stack.sh` runs from `current`.** The release's `env/prod.env` holds
  the tags that are actually running, written by the agent at deploy
  time. `stack.sh up` from `current` therefore reproduces what Control
  deployed, with no pull and no risk of a newer branch's scripts running
  against older images. Committing "Updating prod Olympus image ID" stops;
  the deployed state lives in Control's releases.
- **nginx mounts its server blocks from `current`** instead of from the
  checkout. A release that changes them ends with `stack.sh
nginx-reload`, which validates before it reloads.
- **One container can move on its own.** Each of our services in
  `olympus.yml` gets its own tag variable, defaulting to `OLYMPUS_TAG`, so
  deploying a single container is one variable. Hasura and RabbitMQ
  already have their own tags.
- **The prod checkout goes away.** For an emergency, `stack.sh` runs from
  `current`. Going back by hand is `docker cp` of an older release image
  into a directory of its own, and `stack.sh up` from there.
- **Schema changes are already in an image.** Hasura's image applies its
  migrations on start (ADR 0019), so prod never needs source. A release
  that changes `HASURA_TAG` takes a Postgres dump first and is flagged in
  the deploy plan, because going back depends on the down migrations.

### Deploying

- **Everything, one stack, or one container.** The console first shows a
  plan: each service's tag now and after, in `STACKS` order.
- **Checks run before every deploy, and a failed check stops it.**
- **Each stack is gated on health.** The deploy waits for the stack's
  Compose health checks before moving on. A stack that does not come up
  healthy rolls back to the previous release's tags, and the deploy stops.
- **Every action is recorded**: who, when, what and the outcome. That
  covers deploys, rollbacks, builds, prunes, merges and fixes.
- The `data` stack, and any release that moves `HASURA_TAG`, asks for a
  second confirmation.

### Checks

- **Phase one runs `stack.sh check -v` from `current`** and reads its
  lines. `check.mjs` already reports one finding per line, prefixed
  `problem:`, `warning:` or `ok:`, so there is a single source of truth
  while the console is new. The agent can take over the checks natively
  later.
- **Directories:** what `stack.sh bootstrap` creates is checked for
  existence, owner and mode. A **fix** creates or corrects them, after
  showing the change.
- **Secrets are reported, never handled.** The agent reports each one as
  present, empty or missing. It never creates, sends or displays one, and
  the certificate checks read keys only to match them to their
  certificates.

### The registry and pruning

- The console lists repositories and tags with size, age, source commit,
  and where each tag is running.
- **A tag is protected** if any environment is running it, if a deploy
  in progress needs it, or if it is pinned. Everything else is prunable;
  the deployment log, not the registry, is the history.
- Pruning shows the list first, then deletes. Garbage collection, which
  needs the registry read-only for a while, is a separate step.

### Local development

- **Processes are defined in a file on the laptop**, not typed into the
  console: `olympus-processes.json` in the Docker data folder (Neil,
  2026-10-08). It lists each one: package, script, env file, port,
  readiness check and dependencies (the API before the site). The agent
  runs only what is listed, so the console is never a remote shell, and
  the file is edited on the laptop, never through the console.
- Long-running processes (`pnpm dev`) can be started, stopped and
  restarted, singly or as a group. One-shot tasks (build, typecheck,
  lint, test) are run with exit status, duration and history.
- **Logs** stream live and are kept in a file per run, so they survive a
  page refresh.
- **The whole process group is stopped**: SIGTERM, then SIGKILL after a
  timeout, so no Next.js server is left holding a port.
- **A port taken by something the agent did not start** is shown with its
  process ID, with an option to stop it.
- **Processes die with the agent** (Neil, 2026-10-08). The agent records
  what was running and, when it restarts, offers to restore that session.
  It never restores one on its own.

### Metrics

- Live figures come from Docker: CPU, memory and restarts per container,
  and per process for local dev.
- History comes from the monitoring stack's Prometheus, which the
  services already export to. Control queries it; it does not collect
  metrics of its own.

### Certificates

- **Olympus's certificates are Harpocrates's.** The deployment console
  shows the CA console's view of them, filtered to Olympus services, and
  reissue and revoke happen there. It is a section loaded from Olympus,
  and unavailable when Olympus is down.
- **Control's own certificates are pre-issued so they rarely need
  Olympus.** These are the agent listener's server certificate, the
  remote agents' client certificates and the Control host's certificate
  that nginx serves. Each is issued as a pair on one key: a one-year
  certificate, and a successor whose validity begins well before the
  first expires. Both are kept on disk.
  - The agent serves the newest certificate that is valid now, not the
    newest file. It checks at start and daily, and switches when the
    successor becomes valid, reloading nginx for the host certificate.
  - The successor's validity must fall within its issuer's.
  - Harpocrates records the two as one key's lineage, so revoking one
    revokes both.
  - Renewal needs Olympus about once a year, with roughly two years of
    validity in hand. Until Harpocrates issues them, the pair is issued
    by hand, as every certificate is today.

## Consequences

- A bad Olympus release no longer takes down the tool that rolls it back.
  The worst case left is a broken `control` stack, which `stack.sh up
control` from a release directory recovers.
- The Mac Mini stops needing a checkout, and prod stops depending on
  `git pull`. nginx's mount, `stack.sh`'s working directory and the
  record of what is deployed all move to the release directory.
- Deploys stop being commits. `env/prod.env` in the repository describes
  the environment; the image tags running in it are Control's record.
- Builds prefer the laptop. With it away the Mac Mini builds, more
  slowly and at prod's expense.
- Rolling back further than the release being replaced can mean a
  rebuild, since only releases in use are kept.
- The NAS's checks are a one-shot container rather than a shell, so
  anything they need is in that image.
- `olympus-control` moves from `olympus.yml` to `control.yml`, and the
  consoles' registry stops being guaranteed to match.
- `olympus.yml` gains a tag variable per service.
- The local agent is the first Olympus process that runs natively on the
  laptop rather than in Docker or from the IDE.
- There is a second sign-in path. It is narrow and audited, but it is
  one more credential to keep.
- On acceptance, ADR 0011's "build on the Mac Mini" is superseded by
  this record.

## Open

- The break-glass credential's form. Suggested: a passkey, enrolled from
  a session signed in through Olympus and kept in the agent's store, with
  a one-time recovery code (only its hash in the `control` secrets) as
  the last resort; break-glass accepted from the LAN only.
