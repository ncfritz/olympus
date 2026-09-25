import { defineConfig } from "@hey-api/openapi-ts";

// The client for the signer (ADR 0020), internal to this service and not
// part of packages/sdk. Generated from the signer's committed document and
// committed itself, so building the service never needs Python:
// `pnpm generate:signer` after the signer's document changes, and
// `check:signer-client` (in `check:conventions`) fails until it is.
export default defineConfig({
  input: "../signer/openapi/signer.json",
  output: {
    path: process.env.SIGNER_CLIENT_OUT ?? "src/generated/signer",
    postProcess: ["prettier"],
  },
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
