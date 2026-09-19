import { UserConfig } from "@hey-api/openapi-ts";

export const buildConfigForNamedApi = (api: string): UserConfig => {
  return {
    input: {
      path: `./node_modules/@ncfritz/olympus-api/dist/${api}-openapi-spec.json`,
    },
    output: {
      format: "prettier",
      lint: "eslint",
      path: `./src/${api}`,
    },
    parser: {
      transforms: {
        enums: "root",
      },
    },
    plugins: [
      {
        name: "@hey-api/typescript",
      },
      {
        name: "@hey-api/sdk",
        transformer: true,
      },
      {
        name: "@hey-api/schemas",
      },
      {
        name: "@hey-api/client-axios",
        exportFromIndex: true,
        throwOnError: true,
      },
      {
        name: "@hey-api/transformers",
        dates: true,
      },
    ],
  };
};
