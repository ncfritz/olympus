import { UNKNOWN } from "./conventions";

/** An operation of an API document: how a request maps to `api`, `tag` and `operation`. */
export interface OperationEntry {
  /** The document: olympus, dionysus, minerva, minerva-calendar-sync, ... */
  api: string;
  /** Upper case. */
  method: string;
  /** The document's path template, e.g. /dionysus/metadata/movie/{movieId}. */
  path: string;
  operationId: string;
  /** The operation's first tag, or UNKNOWN. */
  tag: string;
}

type OpenApiOperation = { operationId?: string; tags?: string[] };
type OpenApiDocument = {
  paths?: Record<string, Record<string, OpenApiOperation | unknown>>;
};

const METHODS = ["get", "put", "post", "delete", "patch", "head", "options"];

/** The operations of an OpenAPI document that have an operationId. */
export const operationsFromOpenApi = (
  api: string,
  document: OpenApiDocument,
): OperationEntry[] =>
  Object.entries(document.paths ?? {}).flatMap(([path, item]) =>
    METHODS.flatMap((method) => {
      const operation = item[method] as OpenApiOperation | undefined;
      return operation?.operationId
        ? [
            {
              api,
              method: method.toUpperCase(),
              path,
              operationId: operation.operationId,
              tag: operation.tags?.[0] ?? UNKNOWN,
            },
          ]
        : [];
    }),
  );

export interface OperationLookupOptions {
  /** Removed from a path before matching, e.g. "/v1" when the documents' paths omit it. */
  stripPrefix?: string;
}

/**
 * Finds the operation for a request. `path` is either the concrete path
 * (/dionysus/metadata/movie/603, as a client sends it) or an Express route
 * template (/v1/dionysus/metadata/movie/:movieId, as a server matched it);
 * query strings are ignored.
 */
export type OperationLookup = (
  method: string,
  path: string,
) => OperationEntry | undefined;

const normalize = (path: string): string => {
  const bare = path.split(/[?#]/)[0].replace(/\/+$/, "");
  return bare.startsWith("/") ? bare || "/" : `/${bare}`;
};

export const createOperationLookup = (
  entries: readonly OperationEntry[],
  options: OperationLookupOptions = {},
): OperationLookup => {
  const exact = new Map<string, OperationEntry>();
  const templates = new Map<
    string,
    { pattern: RegExp; entry: OperationEntry }[]
  >();
  // Templates with more literal segments first, so /sync-runs/stats wins
  // over /sync-runs/{id}.
  const literals = (path: string) =>
    path.split("/").filter((s) => s && !s.startsWith("{")).length;
  for (const entry of [...entries].sort(
    (a, b) => literals(b.path) - literals(a.path),
  )) {
    const path = normalize(entry.path);
    exact.set(`${entry.method} ${path}`, entry);
    const pattern = new RegExp(
      `^${path
        .split(/\{[^}]+\}/)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[^/]+")}$`,
    );
    const list = templates.get(entry.method) ?? [];
    list.push({ pattern, entry });
    templates.set(entry.method, list);
  }

  return (method, rawPath) => {
    let path = normalize(rawPath);
    if (options.stripPrefix && path.startsWith(`${options.stripPrefix}/`)) {
      path = path.slice(options.stripPrefix.length);
    }
    const upper = method.toUpperCase();
    // An Express template: :name -> {name}
    const template = path.replace(/:(\w+)/g, "{$1}");
    const found = exact.get(`${upper} ${template}`);
    if (found) return found;
    if (template !== path) return undefined;
    return templates.get(upper)?.find(({ pattern }) => pattern.test(path))
      ?.entry;
  };
};
