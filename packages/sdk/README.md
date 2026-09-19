# @ncfritz/olympus-sdk

TypeScript client for the Olympus APIs, generated with
[Hey API](https://heyapi.dev/) from the OpenAPI documents the API commits in
`apps/api/openapi/`. One entry point per API:

```ts
import { describeNote } from "@ncfritz/olympus-sdk/minerva";
import { listMovies } from "@ncfritz/olympus-sdk/dionysus";
import { sendNotification } from "@ncfritz/olympus-sdk/olympus";
```

Consumers depend on it with `"@ncfritz/olympus-sdk": "workspace:*"`.
Nothing is published.

## How it is built

`src/` is generated and not in git. Turbo runs the chain:

```
@ncfritz/olympus-model build
  → @ncfritz/olympus-api build → openapi   (apps/api/openapi/<api>.json)
    → @ncfritz/olympus-sdk generate        (src/generated/<api>)
      → @ncfritz/olympus-sdk build         (dist/<api>)
```

so `pnpm turbo run build --filter=<consumer>...` always compiles consumers
against the current API. After changing an API operation:

```sh
pnpm turbo run build --filter=@ncfritz/olympus-sdk
```

The generator configuration is in `config/`.

## Notes

- Timestamps are strings. The API documents them as plain strings, so the
  date transformer leaves them alone; the site uses luxon and the API uses
  moment.
- Use type-only imports for types: `import { type Note } from
"@ncfritz/olympus-sdk/minerva"`.
