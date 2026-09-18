# Code generators

`pnpm gen <generator>` runs a Turborepo generator from this directory.

| Generator       | Purpose                                                         | Guide                                                                                  |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `api-operation` | Scaffolds one API operation following `docs/conventions/api.md` | [docs/guides/api-operation-generator.md](../../docs/guides/api-operation-generator.md) |

Templates (`templates/**/*.hbs`) are excluded from Prettier; the
generator formats its output instead.
