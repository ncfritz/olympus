// Vitest preset for NestJS apps and NestJS-decorated libraries.
// esbuild (Vitest's default transform) does not emit decorator metadata,
// which Nest's DI and @nestjs/swagger rely on, so SWC does the transform.
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/**/*.spec.ts", "src/main.ts"],
    },
  },
});
