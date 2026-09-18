# @ncfritz/olympus-config

Shared configuration consumed by every workspace package.

| Export                  | Use in                                              |
| ----------------------- | --------------------------------------------------- |
| `tsconfig/nest.json`    | API, agents, model (anything using Nest decorators) |
| `tsconfig/library.json` | Plain TS libraries (shared utilities)               |
| `tsconfig/next.json`    | Site                                                |
| `eslint/node`           | API, agents, model, SDK                             |
| `eslint/react`          | Site, ui, theme                                     |
| `vitest/nest`           | API, agents, model                                  |
| `vitest/node`           | Plain TS libraries                                  |

Example `tsconfig.json`:

```json
{ "extends": "@ncfritz/olympus-config/tsconfig/nest.json" }
```

Example `eslint.config.mjs`:

```js
import node from "@ncfritz/olympus-config/eslint/node";
export default [...node];
```

Example `vitest.config.ts`:

```ts
export { default } from "@ncfritz/olympus-config/vitest/nest";
```

Test files are excluded from `tsc` builds by the Nest and library presets.
Tests import `describe`/`it`/`expect` from `"vitest"` (globals are off).

`pnpm-workspace.yaml` lists packages allowed to run install scripts
(`onlyBuiltDependencies`). Add native dependencies such as `sharp` or
`prisma` there when a package that needs them is imported.

The base tsconfig keeps the compiler options the existing repos use
(`strict: false` with `strictNullChecks`, `noImplicitAny`, etc.), so
imported code compiles without changes. Tightening strictness is tracked in
`docs/roadmap.md`.
