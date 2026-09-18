import swc from "unplugin-swc";
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
  },
});
