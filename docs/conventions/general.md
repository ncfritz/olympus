# General conventions

## Language and formatting

- TypeScript everywhere. Compiler options come from
  `@ncfritz/olympus-config/tsconfig/*` (see ADR 0004). Do not loosen them per
  package.
- Formatting is Prettier's defaults with `trailingComma: "all"`: double
  quotes, semicolons, 2-space indent, 80-column wrap. Do not hand-format.
- ESLint config comes from `@ncfritz/olympus-config/eslint/*`. A disable
  comment must name the rule and sit on the line it applies to.

## Naming

| Thing                                   | Convention                                         | Example                                             |
| --------------------------------------- | -------------------------------------------------- | --------------------------------------------------- |
| Class, enum, type                       | PascalCase                                         | `MeetingAttendee`, `NoteType`                       |
| Enum members                            | PascalCase, or UPPER_SNAKE for operator-like enums | `MeetingStatus.Busy`, `FilterType.GREATER_THAN`     |
| Enum values                             | Match the wire value exactly                       | `Busy = "Busy"`, `ASC = "asc"`                      |
| Functions, variables, properties        | camelCase                                          | `toDomainObject`, `startTime`                       |
| Module-level constants                  | UPPER_SNAKE                                        | `NOTE_WITH_ASSOCIATIONS`, `SEARCH_EXECUTION_PREFIX` |
| File holding one class                  | The class name, minus a `Controller` suffix        | `UpdateCalendarItem.ts`, `BaseNoteController.ts`    |
| File holding functions or several types | camelCase                                          | `filterUtil.ts`, `meetings.ts`                      |
| Workspace package                       | `@ncfritz/olympus-<name>`                          | `@ncfritz/olympus-model`                            |

Domain words used across the codebase: **Olympus** (platform: admin,
notifications), **Dionysus** (media: content, metadata, media assets,
workflows, jobs), **Minerva** (personal productivity: notes, meetings).
**Hephaestus** appears in the model. New top-level domains get an ADR.

## Dates and times

- Use `moment` (and `moment-timezone` where a zone is needed) in Node code;
  it is already used throughout. Do not add a second date library to a
  package that already uses moment.
- On the wire, timestamps are ISO-8601 strings in UTC.
- A client's timezone arrives in the `x-ncfritz-tz` header and is read in
  the API with `@HeaderTimezone()`. It defaults to `Etc/UTC`.

## Configuration and secrets

- Configuration comes from environment variables read through
  `@nestjs/config`'s `ConfigService` (Nest) or `process.env` (Next.js).
- Env var names are UPPER_SNAKE with a service prefix (`HASURA_HOST`,
  `AMQP_VHOST`, `API_BASE_URL`).
- `*.env` files are not committed. Commit `<name>.env.example` with every
  variable listed and non-secret defaults filled in.
- Never log a secret or a connection string that contains one.
- No API keys in source; read them from config.

## Logging and metrics

- Nest apps log through Winston (`nest-winston`), created in
  `src/util(s)/logger.ts`, shipped to Loki via `winston-loki`.
- Use the module-level `logger` (`logger.info/warn/error`). No
  `console.log` in committed code.
- Prometheus metrics go through the app's `Prometheus*Interceptor` and
  `nestjs-metrics-reporter`.

## Dependencies

- Internal packages: `"workspace:*"`.
- A third-party dependency used by more than one package goes in the
  `catalog:` in `pnpm-workspace.yaml` and is referenced as `"catalog:"`.
- Never depend on `"latest"`.

## Tests

- Test files are `*.spec.ts` / `*.spec.tsx`, next to the code under test,
  or under `test/` for integration tests.
- Vitest, with the presets from `@ncfritz/olympus-config/vitest/*`.
  Import `describe`, `it`, `expect` and `vi` from `"vitest"` explicitly;
  test globals are off.
- See ADR 0010 for which kinds of tests to write first.

## Documentation

- Architectural decisions go in `docs/decisions/` as ADRs.
- Conventions go here. Step-by-step instructions go in `docs/guides/`.
