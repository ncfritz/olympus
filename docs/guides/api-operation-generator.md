# `api-operation` generator

`pnpm gen api-operation` scaffolds one API operation that follows
[`docs/conventions/api.md`](../conventions/api.md) (ADR 0009). The
generator lives in `turbo/generators/config.ts`; its templates are in
`turbo/generators/templates/api-operation/`.

## Usage

Interactive:

```sh
pnpm gen api-operation
```

Non-interactive (answers in prompt order; every prompt must be given,
including the ones that don't apply to the chosen verb):

```sh
pnpm turbo gen api-operation --args \
  minerva notes NotesModule Describe NoteAssociation NoteAssociations \
  DescribeNoteAssociation /noteAssociation/:noteAssociationId Notes \
  minerva_note_associations uuid minerva/notes.ts PartialNoteAssociation true
```

## Prompts

| #   | Prompt           | Example                               | Notes                                                     |
| --- | ---------------- | ------------------------------------- | --------------------------------------------------------- |
| 1   | Domain           | `minerva`                             | `olympus`, `dionysus` or `minerva`                        |
| 2   | Area             | `notes`, `content/channels`           | feature folder under `src/<domain>`; may be new           |
| 3   | Module           | `NotesModule`                         | defaults to the folder's module, or `<Area>Module` if new |
| 4   | Verb             | `Describe`                            | `Describe`, `List`, `Create`, `Update`, `Delete`, `Get`   |
| 5   | Entity           | `NoteAssociation`                     | an existing model class                                   |
| 6   | Plural           | `NoteAssociations`                    | defaults to a simple plural                               |
| 7   | operationId      | `DescribeNoteAssociation`             | defaults to verb + entity (`List` + plural)               |
| 8   | Route            | `/noteAssociation/:noteAssociationId` | defaults per verb, see below                              |
| 9   | Tag              | `Notes`                               | defaults to the area in Title Case                        |
| 10  | Hasura table     | `minerva_note_associations`           | the root field                                            |
| 11  | Primary key type | `uuid`                                | `uuid`, `String` or `Int`; used by Describe/Update/Delete |
| 12  | Model file       | `minerva/notes.ts`                    | where request/response shapes are appended                |
| 13  | Body class       | `PartialNoteAssociation`              | used by Create/Update                                     |
| 14  | Paginated        | `true`                                | used by List                                              |

Route defaults:

| Verb     | Method | Route                    | Success                                             |
| -------- | ------ | ------------------------ | --------------------------------------------------- |
| Describe | GET    | `/<entity>/:<entity>Id`  | 200                                                 |
| List     | GET    | `/<entities>`            | 200 (pagination + filter parameters when paginated) |
| Create   | POST   | `/<entities>`            | 201                                                 |
| Update   | PUT    | `/<entity>/:<entity>Id`  | 200                                                 |
| Delete   | DELETE | `/<entity>/:<entity>Id`  | 204                                                 |
| Get      | GET    | `/<entities>/statistics` | 200                                                 |

## Output

1. `apps/api/src/<domain>/<area>/controllers/<operationId>Controller.ts`: a
   thin controller in house style that calls the entity service.
2. A method on `apps/api/src/<domain>/<area>/services/<Entity>Service.ts`
   (the service is created if needed): a GraphQL document named after the
   operation, a typed result, not-found handling for `*_by_pk` roots, and
   `buildPaginationExpression` / `buildFilterExpression` for paginated
   lists. The method is `describe`, `list`, `create`, `update` or `delete`
   when the operationId is the default one and the name is free, otherwise
   the operationId in camelCase.
3. `apps/api/test/api/<domain>/<operationId>.spec.ts`: an endpoint test
   on the shared harness ([API tests](api-testing.md)) with a 404 test for
   operations that take an ID, a 400 test for paginated lists and an
   `it.todo` for the happy path.
4. `apps/api/src/<domain>/<area>/converters/<Entity>Converter.ts` with a
   `GraphQl<Entity>` / `toDomainObject` stub, if it doesn't exist.
5. `<operationId>Request` / `<operationId>Response` appended to the model
   file, with imports added for the entity, body class and
   `PaginatedResults` as needed. A new model file is exported from its
   domain index.
6. The controller, and the service as a provider, registered in the feature module. For a
   new feature folder the module is created (importing
   `GraphQLClientModule`) and added to the domain's `<DOMAIN>_MODULES`,
   which serves it under the domain prefix and puts it in the OpenAPI
   document.
7. Everything formatted with Prettier.

## Finishing an operation

The generated code compiles and lints, and passes every convention check
except one on purpose: summaries and descriptions start as `TODO`, and
both the API check (`todo` rule) and the model check (`description-todo`)
fail until they are written. Then:

1. Fill in the TODOs: the GraphQL selection set, the converter fields,
   the column mapping for Create/Update, summary and descriptions.
2. `pnpm --filter @ncfritz/olympus-api check:conventions` and
   `pnpm --filter @ncfritz/olympus-model test`.
3. `pnpm turbo run openapi --filter=@ncfritz/olympus-api` and commit the
   `apps/api/openapi/*.json` diff (the model schema snapshot changes too:
   `pnpm --filter @ncfritz/olympus-model test:update`).

## Changing the generator

Templates are the executable copy of the conventions: when a convention
changes, update the doc, the templates and the checks together. Test a
change by generating all six verbs into a scratch branch and running the
build, lint, tests and `check:conventions` (this is how the generator was
verified).
