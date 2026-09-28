import type { FilterDefinition } from "@ncfritz/olympus-sdk/dionysus";

export abstract class ApiBase {
  public encodeFilters(
    value: FilterDefinition | undefined,
  ): string | undefined {
    return value
      ? Buffer.from(JSON.stringify(value)).toString("base64")
      : undefined;
  }
}
