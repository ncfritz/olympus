# 0014. Feature-folder layout and service layer for the API

- **Status:** Accepted (folders and services done; cross-cutting pieces next)
- **Date:** 2026-09-19

## Context

The API grew as one folder per kind of file: `src/controller`,
`src/convert`, `src/query`, `src/types` and nine `*ApiModule` classes in
`src/module`. Controllers talk to Hasura, convert rows, raise 404s and
publish to RabbitMQ themselves; shared behaviour lives in ten
`Base*Controller` classes. NestJS recommends feature modules, thin
controllers and injectable services, plus app-wide pipes, guards and
interceptors registered as providers. Nest's file naming
(`create-note.controller.ts`) does not match ours, where the file is named
after the class.

## Decision

Follow Nest's structure with our naming:

```
src/<domain>/<area>/
  <Area>Module.ts
  controllers/<OperationId>Controller.ts
  services/<Entity>Service.ts
  converters/<Entity>Converter.ts
  queries/<entity>.ts
  types/<entity>.ts
```

- A feature (`<area>`) is one former controller folder, so the content,
  media, metadata and job groups are split into several features
  (`dionysus/content/channels`, `dionysus/metadata/movies`, ...). A group
  keeps what its features share at its own level.
- Each domain has `<Domain>Module.ts` with `<DOMAIN>_MODULES`, the one list
  used for the `RouterModule` prefix and the OpenAPI document.
- Infrastructure modules live in `src/infra`.
- Layers are controller → service. A controller parses and validates the
  request, calls one service method and writes the response. A service
  per entity holds the inline `gql` documents, conversion, not-found
  handling and messaging; services replace the `Base*Controller` classes.
  There is no separate repository layer: the API is the only Hasura
  client and each document is used by one operation.

Work happens in three steps, each with all tests green:

1. Move files to feature folders, rename controller files and create the
   feature modules. No behaviour change. **Done.**
2. Extract services one feature at a time, enforced by the
   `thin-controller` check (no `gql`, `GraphQLClient`, `AmqpConnection` or
   gateway in a controller). **Done:** 37 services, every `Base*Controller`
   removed; Minerva notes is the reference feature.
3. Cross-cutting: content authentication as a guard and the curtain as a
   parameter decorator; `APP_INTERCEPTOR` / `APP_PIPE` providers instead
   of `configureApp`; typed, validated configuration; Nest's `Logger`
   backed by Winston. `ValidationPipe` is decided separately.

## Consequences

- Everything about one feature is in one folder; new features get a
  module from the generator.
- Convention checks cover the layout: `file-name` expects
  `<OperationId>Controller.ts`, `feature-module` requires the controller
  in the module beside its folder, and `route-shadow` catches a
  parameterised route registered before a static one. The move surfaced
  two such routes (`/workflow/stats`, `/content/workflow/stats`) whose
  correctness depended on array order.
- Module order now decides OpenAPI path order. Shared enum schemas no
  longer depend on it: they carry `enumSchema` descriptions.
- 30 feature modules instead of 9 area modules.
