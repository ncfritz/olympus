import swc from "unplugin-swc";
import { coverage } from "@ncfritz/olympus-config/vitest/coverage";
import { defineConfig } from "vitest/config";

// Same as @ncfritz/olympus-config/vitest/nest, except decorator metadata is
// NOT emitted: the model's tsconfig turns it off, and schema output must
// match the real build (without metadata, @nestjs/swagger relies only on
// the explicit `type` in each @ApiProperty).
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: false },
      },
    }),
  ],
  test: {
    include: ["test/**/*.spec.ts"],
    environment: "node",
    coverage,
    // `pnpm test:report` writes a static test report here (viewable
    // without a running server); `pnpm test:ui` serves the interactive UI.
    outputFile: { html: "test-report/index.html" },
  },
});
