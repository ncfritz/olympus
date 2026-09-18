# Model conventions (`packages/model`)

`@ncfritz/olympus-model` holds the API's domain objects and its request and
response shapes. Classes are decorated with `@nestjs/swagger` so the API's
OpenAPI documents, and from them the SDK, are generated from this package.
The model is the source of truth for the API contract.

## Layout

```
src/
  index.ts                 re-exports each domain
  common.ts                cross-domain shapes (EmptyResponse, PaginatedResults, SortDirection)
  filter.ts                FilterDefinition / FilterType
  <domain>/                olympus | dionysus | minerva | hephaestus
    index.ts               export * from each area file
    <area>.ts              e.g. minerva/meetings.ts, minerva/notes.ts
    <area>/                larger areas become folders with their own index.ts
```

- Every new file is exported from its folder's `index.ts`, up to
  `src/index.ts`.
- Inside an area file, order the contents as: enums, domain objects, partial
  and derived types, request shapes, response shapes. Separate the groups
  with the banner comment already used in the codebase:

```ts
/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */
```

## Domain objects

- Plain classes (not interfaces) so decorators apply. Property names are
  camelCase. The API converts from Hasura's snake_case (see
  [api.md](api.md#converters)).
- **Every property has `@ApiProperty`** (or `@ApiTimestamp`) with an
  explicit `required` and a `description` sentence. **[checked]**
- **The decorator must describe the declared type.** `type` names the same
  class or primitive, `isArray` matches arrays, `enum` names the declared
  enum. **[checked]**
- Optional properties are `required: false` **and** declared optional
  (`uid?: string`). The two must agree. **[checked]**
- Reference other classes lazily: `type: () => Meeting`. Arrays add
  `isArray: true`. Nested arrays use
  `type: "array", items: NUMBER_MATRIX_SCHEMA.items`.
- Enums are string enums whose values are the wire values. Decorate as
  `enum: () => MeetingStatus, enumName: "MeetingStatus"`. `enumName` is
  required and must equal the enum's name. **[checked]**
- **Timestamps** are typed `Moment` and decorated with
  `@ApiTimestamp({ required, description })` from `src/decorators.ts`. It
  documents an ISO-8601 string and adds a null-safe `@Transform`. Do not
  hand-write `@ApiProperty({ type: String })` + `@Transform` pairs.
- **Maps** (`Record<K, V>`) are documented with `type: Object` and
  `additionalProperties`: a schema constant (`NUMBER_ARRAY_SCHEMA`), or
  `{ $ref: getSchemaPath(V) }` plus `@ApiExtraModels(V)` on the class.
  Never document a map as a single `V`. **[checked]**
- **No `type: Object`** for structured data. Give the structure a class
  (see the `…Categories` / `…Series` classes behind the statistics
  responses). Chart series use `ChartSeries` from `common.ts`. **[checked]**
- **Unions** of different types need `oneOf`. **[checked]**

```ts
export class Meeting {
  @ApiProperty({
    type: String,
    required: true,
    description: "The unique ID of the meeting",
  })
  id: string;

  @ApiProperty({
    enum: () => MeetingStatus,
    enumName: "MeetingStatus",
    required: true,
    description: "The free/busy status of the meeting",
  })
  status: MeetingStatus;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string indicating when the meeting starts",
  })
  startTime: Moment;
}
```

Create/update shapes that drop the server-managed audit timestamps use the
`AUDIT_FIELDS` constant:

```ts
export class PartialGenre extends OmitType(Genre, [...AUDIT_FIELDS]) {}
```

### Entity variants

When one entity needs several shapes, use these names:

| Name                  | Meaning                                                 |
| --------------------- | ------------------------------------------------------- |
| `Base<Entity>`        | Fields supplied on create (no server-generated fields)  |
| `<Entity>`            | The standard representation                             |
| `Full<Entity>`        | The standard representation plus expanded relationships |
| `Partial<Entity>`     | `extends PartialType(<Entity>)`; used for update bodies |
| `<Entity>With<Thing>` | A specific expansion (`BaseNoteWithAssociations`)       |

## Request and response shapes

- **Named after the operation:** `<OperationId>Request` and
  `<OperationId>Response`. `ListNotificationsResponse` belongs to operation
  `ListNotifications`. **[checked]**
- The payload sits under a property named after the entity, never a generic
  `item`/`data`:
  - single entity: singular camelCase (`notification`, `channel`)
  - list: plural camelCase (`notifications`, `notes`)
  - count: `count`
- Update requests carry a `Partial<Entity>`. Create requests carry a
  `Base<Entity>` or `Partial<Entity>`.
- Paginated list responses `extends PaginatedResults` (adds `count`, the
  total before paging).
- An operation that returns nothing uses `EmptyResponse`.
- An operation with no body still gets an empty `<OperationId>Request`
  class only if it is likely to gain fields. Otherwise omit it.

```ts
export class UpdateNotificationSettingRequest {
  @ApiProperty({
    type: () => PartialNotificationSetting,
    required: true,
    description: "The notification setting to update.",
  })
  notificationSetting: PartialNotificationSetting;
}

export class UpdateNotificationSettingResponse {
  @ApiProperty({
    type: () => NotificationSetting,
    required: true,
    description: "The notification setting with updates applied.",
  })
  notificationSetting: NotificationSetting;
}
```

## What does not belong in the model

- Hasura (`GraphQl*`) types and converters. Those live in the API.
- RabbitMQ message payloads exchanged only between agents. Those live with
  the agent, or in a shared package if more than one service uses them.
- Business logic. Small pure helpers on a shape are fine.

## Validation

`class-validator` is a dependency but no decorators are used, and the API's
global `ValidationPipe` is commented out. New shapes do not need validation
decorators until that decision is made (tracked in the roadmap).

## Tests and checks

| Test                        | What it protects                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `test/schemas.spec.ts`      | Snapshot of the OpenAPI schema of every exported class. A refactor must leave it unchanged; a contract change updates it and the diff shows what the SDK will see. |
| `test/enums.spec.ts`        | Snapshot of every enum's values (persisted in Hasura, sent over RabbitMQ).                                                                                         |
| `test/decorators.spec.ts`   | `@ApiTimestamp` serialization.                                                                                                                                     |
| `test/defaults.spec.ts`     | Property initializers match the documented `default`.                                                                                                              |
| `test/api-property.spec.ts` | The decorator/type rules above (`pnpm check:conventions`). Exceptions live in `test/api-property.allow.json` and may only shrink.                                  |

```sh
pnpm --filter @ncfritz/olympus-model test          # all of the above
pnpm --filter @ncfritz/olympus-model test:coverage # plus coverage; open coverage/index.html
pnpm --filter @ncfritz/olympus-model test:ui       # interactive Vitest UI (watch mode, with a Coverage tab)
pnpm --filter @ncfritz/olympus-model test:report   # static HTML test report in test-report/
pnpm --filter @ncfritz/olympus-model test:update   # accept a snapshot change (review the diff)
pnpm --filter @ncfritz/olympus-model check:allow-update  # rewrite the allow-list (review the diff)
```
