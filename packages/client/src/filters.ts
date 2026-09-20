/** A list sort: the field and direction. */
export interface SortOptions {
  field: string;
  order: "asc" | "desc";
}

/**
 * The `filters` query parameter of the operations that take a
 * FilterDefinition: base64 of its JSON (UTF-8). Works in browsers and Node.
 */
export const encodeFilters = (filters: object): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(filters));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

/** Accepts 404 as an answer ("none") instead of an error. */
export const okOrNotFound = (status: number): boolean =>
  (status >= 200 && status < 300) || status === 404;
