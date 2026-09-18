# @ncfritz/olympus-model

Domain objects and request/response shapes for the Olympus API, annotated
with `@nestjs/swagger` so the API's OpenAPI documents (and from them the
SDK) are generated from this package.

- Consumed by `apps/api` as `"@ncfritz/olympus-model": "workspace:*"`.
  Nothing is published.
- Conventions: [`docs/conventions/model.md`](../../docs/conventions/model.md).

```sh
pnpm turbo run build --filter=@ncfritz/olympus-model
```

Imported from `github.com/ncfritz/olympus-model` with full history.
