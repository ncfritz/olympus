# Code generators

`pnpm gen <generator>` runs a Turborepo generator from this directory.

| Generator       | Purpose                                                         | Guide                                                                                  |
| --------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `api-operation` | Scaffolds one API operation following `docs/conventions/api.md` | [docs/guides/api-operation-generator.md](../../docs/guides/api-operation-generator.md) |
| `console`       | Scaffolds a console for Olympus Control and registers it        | [docs/guides/console-generator.md](../../docs/guides/console-generator.md)             |

Templates (`templates/**/*.hbs`) are excluded from Prettier; the
generator formats its output instead.
