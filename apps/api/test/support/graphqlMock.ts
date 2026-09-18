import { vi } from "vitest";

type Variables = Record<string, unknown> | undefined;
type Handler = (variables: Variables, document: string) => unknown;

/**
 * Stand-in for the injected GraphQLClient. Every document the API sends is
 * named after its operation (`query DescribeNote(...)`), so responses are
 * registered by operation name. An operation with no registered response
 * fails the test, so tests state every Hasura call they expect.
 */
export class GraphQLMock {
  private readonly handlers = new Map<string, Handler>();

  readonly request = vi.fn(async (document: unknown, variables?: Variables) => {
    const text = String(document);
    const name = operationName(text);
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Unexpected GraphQL operation "${name}"`);
    }
    return handler(variables, text);
  });

  /** Respond to `operation` with `response` (or the result of a function). */
  on(operation: string, response: Handler): this;
  on(operation: string, response: unknown): this;
  on(operation: string, response: unknown): this {
    this.handlers.set(
      operation,
      typeof response === "function"
        ? (response as Handler)
        : () => structuredClone(response),
    );
    return this;
  }

  /** Make `operation` fail the way graphql-request does on a GraphQL error. */
  fail(operation: string, message = "GraphQL error"): this {
    this.handlers.set(operation, () => {
      throw new Error(message);
    });
    return this;
  }

  /** Every call to `operation`, in order. */
  calls(operation: string): { variables: Variables; document: string }[] {
    return this.request.mock.calls
      .map(([document, variables]) => ({
        document: String(document),
        variables: variables as Variables,
      }))
      .filter((call) => operationName(call.document) === operation);
  }

  reset(): void {
    this.handlers.clear();
    this.request.mockClear();
  }
}

const operationName = (document: string): string =>
  /\b(?:query|mutation|subscription)\s+(\w+)/.exec(document)?.[1] ??
  "<anonymous>";
