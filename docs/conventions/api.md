# API conventions (`apps/api`)

The API is a NestJS application. It is the **only** client of Hasura, and
the only surface the site and agents call (through the SDK). Every HTTP
operation is one controller class in one file.

Related: [model.md](model.md) for request/response shapes,
[ADR 0008](../decisions/0008-preserve-and-enforce-api-conventions.md) for
enforcement, [ADR 0009](../decisions/0009-api-operation-generator.md) for
the generator (`pnpm gen api-operation`).

## Layout

Code is organised by feature, as NestJS recommends, with PascalCase file
names instead of Nest's `operation.controller.ts` style
([ADR 0014](../decisions/0014-feature-folder-layout.md)).

```
src/
  main.ts                    bootstrap: versioning, CORS, interceptors, OpenAPI explorer
  configureApp.ts            app-wide middleware and pipes (shared with the tests)
  AppModule.ts               infrastructure + the three domain modules, RouterModule prefixes
  infra/                     GraphQLClientModule (Hasura), RabbitModule (AMQP), metrics interceptor
  schema/                    OpenAPI document definitions (schemas.ts, documentBuilder.ts)
  utils/                     controllerDecorators, filterUtil, location, logger, routes, ...
  <domain>/
    <Domain>Module.ts        <DOMAIN>_MODULES: the feature modules served under /<domain>
    types/ ...               shared by several features of the domain
    <area>/                  one feature, e.g. minerva/notes, dionysus/content/channels
      <Area>Module.ts        registers the feature's controllers (NotesModule, TvModule, ...)
      controllers/<OperationId>Controller.ts
      converters/<Entity>Converter.ts
      queries/<entity>.ts    shared GraphQL selection sets
      types/<entity>.ts      API-internal row and helper types
```

A group of features (`dionysus/content`, `dionysus/media`,
`dionysus/metadata`, `dionysus/jobs`) may keep what its features share in
`converters/`, `queries/` or `types/` at the group level
(`dionysus/metadata/converters/CastConverter.ts`).

`<domain>` is `olympus`, `dionysus` or `minerva`.

## Operations

### Naming

- The **operationId** is `<Verb><Noun>` in PascalCase. It names the class
  and the file: operation `UpdateCalendarItem` is
  `UpdateCalendarItemController` in
  `minerva/meetings/controllers/UpdateCalendarItemController.ts`.
  **[checked]**
- Verbs:

| Verb         | Use for                                                                     |
| ------------ | --------------------------------------------------------------------------- |
| `Create`     | Insert a new entity                                                         |
| `Describe`   | Fetch one entity by ID                                                      |
| `List`       | Fetch a collection (optionally paginated or filtered)                       |
| `Get`        | Fetch a computed value: count, summary, statistics                          |
| `Update`     | Change an existing entity                                                   |
| `Delete`     | Remove (or soft-delete) an entity                                           |
| `Restore`    | Undo a soft delete                                                          |
| Domain verbs | `Send`, `Acknowledge`, `Refresh`, `Publish`, ... when none of the above fit |

- Operation IDs are unique across all three OpenAPI documents. **[checked]**

### Routes

- URI versioning. Every controller is `@Controller({ version: "1" })`.
  **[checked]**
- The domain prefix (`/olympus`, `/dionysus`, `/minerva`) comes from the
  `RouterModule` registration of the domain module in `AppModule`. Do not
  repeat it in the route.
- Method routes start with `/`.
- **Collections are plural** (`POST /content/channels`,
  `GET /notifications`). **Single items are singular with an ID parameter**
  (`GET /content/channel/:channelId`, `PUT /meeting/:meetingId`).
- Path parameters are camelCase and named `<entity>Id`.
- Sub-resources nest under the parent item:
  `/content/asset/:assetId/tag/:tagId`.
- Actions that aren't CRUD are a verb segment on the item:
  `POST /content/channel/:channelId/refresh`.
- Express tries routes in registration order, so a static route
  (`/workflow/stats`) is registered before a parameterised route that
  would match it (`/workflow/:workflowId`): list its controller first in
  the module, or its module first in `<DOMAIN>_MODULES`. **[checked]**

### Controller shape

```ts
@Controller({ version: "1" })
export class DescribeNoteController {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  @Get("/note/:noteId")
  @ApiOperation({
    summary: "Describes a note",
    description: "Returns a single note, including its associations.",
    operationId: "DescribeNote",
    tags: ["Notes"],
  })
  @ApiProduces("application/json")
  @ApiParam({ name: "noteId", description: "The ID of the note", type: String })
  @ApiOkResponse({
    description: "The note was found.",
    type: DescribeNoteResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Param("noteId") noteId: string,
    @Res() response: Response,
  ): Promise<void> {
    // 1. build the gql document
    // 2. request it
    // 3. null → NotFoundException
    // 4. convert with toDomainObject
    // 5. response.status(HttpStatus.OK).send(body)
  }
}
```

Rules:

- **One route per class**, in a method named `handle`. **[checked]**
- `handle` returns `Promise<void>` and writes the response through
  `@Res() response: Response` (Express) with
  `response.status(HttpStatus.X).send(body)`. **[checked]**
- After any early `response...send()/end()`, `return`. Never send twice.
- The response body is typed with the model class
  (`const body: DescribeNoteResponse = { note }`).
- Constructor parameters are `private readonly`. Inject `GraphQLClient` for
  Hasura, `AmqpConnection` to publish messages, `ConfigService` for config.
- Logic shared by several operations in an area goes in an abstract
  `Base<Area>Controller` in the same folder (e.g. `BaseNoteController`),
  which the operation controllers extend.

### Decorator order

Apply decorators in this order, omitting the ones that don't apply:

1. `@Get/@Post/@Put/@Patch/@Delete(route)`
2. `@ApiOperation({ summary, description, operationId, tags })`: all four
   required. **[checked]**
   - `summary`: short phrase, sentence case, no trailing period
   - `description`: one or more full sentences
   - `tags`: one tag, the area in Title Case plural (`"Notes"`, `"Meetings"`)
   - no two operations share a summary or a description (a sign of
     copy-paste). **[checked]**
3. `@ApiConsumes("application/json")`: when there is a body
4. `@ApiProduces("application/json")`
5. `@ApiParam(...)`: one per path parameter, with `description` and `type`
6. `@ApiQuery(...)`, `@ApiPaginationParams()`, `@ApiFilterParams()`
7. `@ApiBody({ type, required, description })`
8. Success response: `@ApiOkResponse`, `@ApiCreatedResponse` or
   `@ApiNoContentResponse`, with `description` and `type`
9. `@ApiStandardErrorResponses()`: always, last. **[checked]**

### Status codes

| Situation                                           | Status                             | Decorator                       |
| --------------------------------------------------- | ---------------------------------- | ------------------------------- |
| Read, update, action with a body                    | `200 OK`                           | `@ApiOkResponse`                |
| Create                                              | `201 Created`                      | `@ApiCreatedResponse`           |
| Success with no body                                | `204 No Content`                   | `@ApiNoContentResponse`         |
| Accepted for async processing                       | `202 Accepted`                     | `@ApiResponse({ status: 202 })` |
| Update with an empty change set                     | `304 Not Modified`                 |                                 |
| Delete (existing content, tag and favorite deletes) | `410 Gone` with the removed record | `@ApiGoneResponse`              |

New deletes use `204 No Content` (the generator's default). A few existing
deletes answer `410 Gone` with the removed record; that is accepted for
`DELETE` operations only.

The status sent must match the success decorator. **[checked]**

### Created resources

A `201 Created` response carries a `Location` header naming the created
resource's GET route, set with `setLocation()` from `src/utils/location.ts`:

```ts
setLocation(response, httpRequest, DescribeNoteController, {
  noteId: createdNote.id,
});
response.status(HttpStatus.CREATED).send(responseBody);
```

- The URL comes from the target controller's route metadata, so it can't
  drift from the real route: `/v1/minerva/note/<id>`. Behind nginx it is
  prefixed with `X-Forwarded-Prefix` (`/api/v1/...`).
- The handler takes `@Req() httpRequest: Request` for this (`request` is
  the body by convention).
- When there is no GET route for what was created, send no `Location` and
  don't document one. Don't point it at a list.
- Document the header on the `201` response exactly when it is set:
  `headers: { Location: { schema: { type: "string" }, description } }`.
  **[checked]**

### Errors

- Throw Nest's HTTP exceptions; don't hand-write error bodies:
  `NotFoundException`, `BadRequestException`, `ConflictException`,
  `UnauthorizedException`.
- A `*_by_pk` query or mutation that returns `null` means the entity doesn't
  exist → `NotFoundException` with a message naming the entity and ID.
- Error bodies are `ErrorResponse` (`message`, `statusCode`), documented by
  `@ApiStandardErrorResponses()`. Pass `{ exclude: [...] }` to drop codes
  that can't occur.

### Pagination, sorting and filtering

- Paginated lists use `@ApiPaginationParams()` (`sort`, `sortBy`,
  `pageSize`, `startPage`) and return a response extending
  `PaginatedResults`.
- Filterable lists use `@ApiFilterParams()`: `filters` is a base64-encoded
  JSON `FilterDefinition`. Build the Hasura `where` with
  `buildFilterExpression()` from `utils/filterUtil.ts`.

## Hasura access

- Use the injected `GraphQLClient`. Do not create other clients.
- Write the document inline with `gql`. **Name the GraphQL operation after
  the API operation** (`mutation UpdateCalendarItem(...)`). A controller
  with a second document names it after what it does
  (`query GetCalendarItemSeries`). Every document is named, and a name
  means the same document everywhere it appears: Hasura logs and the test
  double route by it. **[checked]**
- Pass values as GraphQL variables, not string interpolation. Interpolation
  is allowed only for shared selection sets and for the `where` / paging
  expressions produced by `buildFilterExpression()` and
  `buildPaginationExpression()`. A `where` built in code is passed as a
  `_bool_exp` variable.
- Declare the response type next to the controller:
  `type GraphQl<OperationId>Response = { <root_field>: GraphQl<Entity> }`.
- Selection sets reused across operations are UPPER_SNAKE constants in
  the feature's `queries/<entity>.ts` (`BASE_NOTE`,
  `NOTE_WITH_ASSOCIATIONS`).
- Upserts use `on_conflict` with the named constraint and an explicit
  `update_columns` list.
- New Hasura tables and relationships arrive through migrations and
  generated metadata (ADR 0006), never through the console alone.

### Converters

- Every Hasura entity used by the API has a converter module:
  `converters/<Entity>Converter.ts` in its feature folder.
- It exports the Hasura shape as `GraphQl<Entity>` (snake_case fields, as
  Hasura returns them) and a `toDomainObject()` function that maps it to
  the model's camelCase class:
  `toDomainObject(input: GraphQl<Entity>): <Entity>`.
- Parse timestamps with `moment(...)`. Map optional fields to `undefined`,
  not `null`.
- Nested objects get their own `build<Thing>` helper in the same file.
- Converters are pure functions: no I/O and no Nest injection. They are
  the first thing to unit-test.

## Messaging

- Operations that start asynchronous work publish to RabbitMQ with the
  injected `AmqpConnection` and return `202 Accepted` (or the created
  tracking entity).
- Exchange and routing-key names are constants in `utils/constants.ts`.

## Registering an operation

1. Add the controller class to the `controllers` array of the
   `<Area>Module.ts` beside its `controllers/` folder. **[checked]**
2. A new feature module is added to its domain's `<DOMAIN>_MODULES` in
   `src/<domain>/<Domain>Module.ts`. That list is what `AppModule` serves
   under the domain prefix and what `src/schema/schemas.ts` puts in the
   domain's OpenAPI document. **[checked]**
3. Run `pnpm turbo run generate --filter=@ncfritz/olympus-sdk` to
   regenerate the SDK.

`pnpm gen api-operation` does steps 1 and 2 and creates the controller, a test,
the model shapes and a converter stub
([guide](../guides/api-operation-generator.md)).

## Tests

- Every operation has an endpoint test under `test/api/<domain>/`
  covering its success path, 404 when it takes an ID, and 400 for every
  query parameter that reaches a GraphQL document
  ([guide](../guides/api-testing.md)).
- Query parameters are parsed with a Nest pipe or `filterUtil`, never
  interpolated into a GraphQL document as received.

## Checks

| Check                                                | Command                                                |
| ---------------------------------------------------- | ------------------------------------------------------ |
| Controller conventions (this document)               | `pnpm --filter @ncfritz/olympus-api check:conventions` |
| Committed OpenAPI documents match the code           | `check:openapi` (part of the above)                    |
| Spectral on the OpenAPI documents (`.spectral.yaml`) | `lint:openapi` (part of the above)                     |

Known deviations are listed in `test/conventions/controllers.allow.json`
and may only shrink. `pnpm --filter @ncfritz/olympus-api check:allow-update`
rewrites it (review the diff).
