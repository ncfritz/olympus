# Writing API tests

API tests live in two places:

| Kind                  | Where                                  | What it covers                                                          |
| --------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| Unit                  | `apps/api/src/**/<File>.spec.ts`       | Pure code: converters, `utils/` (filters, decorators)                   |
| Endpoint (HTTP-level) | `apps/api/test/api/<domain>/*.spec.ts` | One operation end to end: routing, pipes, controller, converter, status |
| Conventions           | `apps/api/test/conventions`            | Controller metadata rules ([guide](convention-checks.md))               |

Run them:

```sh
pnpm --filter @ncfritz/olympus-api test            # everything
pnpm --filter @ncfritz/olympus-api test:coverage   # + coverage/index.html
pnpm --filter @ncfritz/olympus-api exec vitest test/api/olympus   # one folder, watch mode
```

## Endpoint tests

`createTestApp()` (`test/support/testApp.ts`) boots the real `AppModule`
through `configureApp`, the same pipeline `main.ts` uses, so URI
versioning, route prefixes, pipes and interceptors behave as in
production. Two providers are replaced:

- `GraphQLClient` → `GraphQLMock`. Responses are registered **by GraphQL
  operation name** (`query DescribeNote(...)` → `"DescribeNote"`). A
  document with no registered response throws, so the request fails with
  500 and the test states every Hasura call it expects.
- `AmqpConnection` → `{ publish: vi.fn() }`. No broker is contacted.

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { graphQlNote } from "../../fixtures/minerva";
import { createTestApp, type TestApp } from "../../support/testApp";

describe("Minerva notes API", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp(); // one app per file: boot is the slow part
  });
  afterAll(async () => {
    await t.app.close();
  });
  beforeEach(() => t.reset()); // clears responses, calls and amqp.publish

  it("returns the note", async () => {
    t.graphql.on("DescribeNote", { minerva_notes_by_pk: graphQlNote() });

    const res = await t.http().get("/v1/minerva/note/note-1");

    expect(res.status).toBe(200);
    expect(res.body.note.id).toBe("note-1");
    expect(t.graphql.calls("DescribeNote")[0].variables).toEqual({
      id: "note-1",
    });
  });
});
```

`GraphQLMock` API:

| Call                       | Use                                                         |
| -------------------------- | ----------------------------------------------------------- |
| `on(op, response)`         | Respond with a copy of `response`                           |
| `on(op, (vars, doc) => …)` | Compute the response, e.g. echo variables back              |
| `fail(op, message?)`       | Throw the way graphql-request does on a GraphQL error       |
| `calls(op)`                | `{ variables, document }[]` for assertions on what was sent |

### What to cover per operation

1. **Happy path**: status code, the converted body (`toMatchObject` on the
   fields the converter maps), and the GraphQL variables sent.
2. **Not found**: `*_by_pk` returning `null`, or an empty `returning`,
   answers 404. Also assert the operation was called, so a 404 from a
   mistyped route doesn't pass by accident.
3. **Input handling**: every query parameter that reaches a GraphQL
   document. Bad input must answer 400 **before** Hasura is called
   (`expect(t.graphql.calls(op)).toHaveLength(0)`). Raw interpolation of a
   query parameter into a document is a bug; use a Nest pipe
   (`ParseIntPipe`, `ParseBoolPipe`) or `buildPaginationExpression` /
   `buildFilterExpression`.
4. **Other documented statuses**: 304, 409, 207 and so on.
5. **Side effects**: `t.amqp.publish` calls (exchange, routing key,
   message), and WebSocket pushes by spying on the gateway:
   `vi.spyOn(t.app.get(NotificationsGateway), "send")`.

### Fixtures

`test/fixtures/<domain>.ts` export builders for Hasura rows, shaped like
the converters' `GraphQl<Entity>` types, with overrides:
`graphQlNotification({ acknowledged: true })`. Add a builder the first
time an entity appears in a test rather than inlining rows.

### Time

Pin the clock when a controller computes times from "now". Fake only
`Date`, so Nest and supertest timers keep working:

```ts
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-09-18T12:00:00Z"));
// afterEach: vi.useRealTimers();
```

### Things these tests have caught

Mutated `moment` objects (use `.clone()` before `add`/`subtract`), string
query parameters used as numbers or booleans (`"false"` is truthy),
missing `return` after `response.status(...).send()`, duplicate GraphQL
operation names, and statistics that summed only the first row. Check for
these when reviewing a controller.

## Generated tests

`pnpm gen api-operation` writes `test/api/<domain>/<operationId>.spec.ts`
with the harness set up, a 404 test for operations that take an ID, a
400 test for paginated lists, and an `it.todo` for the happy path. Fill in
the happy path before committing. Tests for an area can later be merged
into one `<area>.spec.ts` file, which boots the app once instead of once
per operation.

## Coverage

`test:coverage` writes `apps/api/coverage/index.html` (and
`coverage-summary.json`). Line coverage on 2026-09-18, after every
operation got endpoint tests:

| Area                           | Lines   |
| ------------------------------ | ------- |
| Olympus, Minerva endpoints     | 95–97%  |
| Dionysus endpoints (all areas) | 95–100% |
| Converters                     | 91–100% |
| `utils/`                       | 93%     |
| Total                          | 95%     |

ADR 0010's ratchet applies: coverage may not go down.

The metadata operations are covered by a table in
`test/api/dionysus/metadata.spec.ts` (one row per read operation, with a
minimal Hasura row from `test/fixtures/metadata.ts`) plus focused tests for
paging, filters and upserts. Converter mappings, including missing related
rows, are unit-tested in
`src/convert/dionysus/metadata/MetadataConverters.spec.ts`.

When a request unexpectedly answers 500, run the test with
`TEST_NEST_LOGS=1` to see Nest's error log and stack.
