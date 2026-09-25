import { defineConfig } from "@hey-api/openapi-ts";

import { API_DOCUMENTS } from "./scripts/documents.mjs";

// One client per committed API document, each exported as
// @ncfritz/olympus-sdk/<api>: the API's (apps/api/openapi/<api>.json) and
// Harpocrates's (ADR 0020).
const APIS = Object.keys(API_DOCUMENTS);

export default defineConfig({
  input: APIS.map((api) => API_DOCUMENTS[api]),
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
