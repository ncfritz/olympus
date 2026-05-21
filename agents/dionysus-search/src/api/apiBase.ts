import type { FilterDefinition } from "@ncfritz/olympus-sdk/dionysus";

export const BASE_URL = process.env.API_BASE_URL || "http://localhost:3001/v1";

export abstract class ApiBase {
  public encodeFilters(
    value: FilterDefinition | undefined,
  ): string | undefined {
    return value
      ? Buffer.from(JSON.stringify(value)).toString("base64")
      : undefined;
  }
}
