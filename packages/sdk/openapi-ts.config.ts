import { defineConfig } from "@hey-api/openapi-ts";

// One client per API document the API commits (apps/api/openapi/<api>.json),
// each exported as @ncfritz/olympus-sdk/<api>.
const APIS = ["olympus", "dionysus", "minerva"];

export default defineConfig({
  input: APIS.map((api) => `../../apps/api/openapi/${api}.json`),
  output: APIS.map((api) => ({
    path: `src/generated/${api}`,
    postProcess: ["prettier"],
  })),
  plugins: [
    "@hey-api/typescript",
    "@hey-api/sdk",
    {
      name: "@hey-api/client-axios",
      exportFromIndex: true,
      throwOnError: true,
    },
  ],
});
