# `api-operation` generator (design)

Status: planned. Built right after `apps/api` and `packages/model` are
imported (ADR 0009).

## Usage

```sh
pnpm gen api-operation
```

## Prompts

| Prompt                             | Example               | Used for                                      |
| ---------------------------------- | --------------------- | --------------------------------------------- |
| Domain                             | `minerva`             | `controller/<domain>/`, OpenAPI document      |
| Area                               | `notes`               | folder, `<Area>ApiModule`, tag                |
| Verb                               | `Describe`            | operationId, HTTP method default, status code |
| Entity                             | `Note`                | operationId, model shapes, converter          |
| Route                              | `/note/:noteId`       | defaulted from verb + entity, editable        |
| Hasura root field                  | `minerva_notes_by_pk` | gql document and response type                |
| Paginated / filterable (List only) | yes / no              | `@ApiPaginationParams`, `@ApiFilterParams`    |

Verb defaults:

| Verb     | Method | Route                   | Success                   |
| -------- | ------ | ----------------------- | ------------------------- |
| Create   | POST   | `/<entities>`           | 201 `@ApiCreatedResponse` |
| Describe | GET    | `/<entity>/:<entity>Id` | 200                       |
| List     | GET    | `/<entities>`           | 200                       |
| Get      | GET    | `/<entities>/<noun>`    | 200                       |
| Update   | PUT    | `/<entity>/:<entity>Id` | 200                       |
| Delete   | DELETE | `/<entity>/:<entity>Id` | 204                       |

## Output

1. `apps/api/src/controller/<domain>/<area>/<OperationId>.ts`: controller
   in the shape from `docs/conventions/api.md`, decorators in order,
   `gql` document named after the operation, `GraphQl<OperationId>Response`
   type, not-found handling for `_by_pk` roots, `TODO` markers where
   selection sets and descriptions must be filled in.
2. `packages/model/src/<domain>/<area>.ts`: appends `<OperationId>Request`
   (when there is a body) and `<OperationId>Response` under the right
   banner, and adds the export if the file is new.
3. `apps/api/src/convert/<domain>/<Entity>Converter.ts`: created with
   `GraphQl<Entity>` and `toDomainObject` stubs if it doesn't exist.
4. `apps/api/src/module/<Area>ApiModule.ts`: import added and controller
   appended to `controllers`. A new module is also registered in
   `AppModule` and `schema/schemas.ts`.
5. `apps/api/src/controller/<domain>/<area>/<OperationId>.spec.ts`: a test
   stub with the `GraphQLClient` mocked.

Generated code must pass `pnpm check:conventions` without edits (TODOs
aside). A generator test runs it into a temp copy and runs the checks.
