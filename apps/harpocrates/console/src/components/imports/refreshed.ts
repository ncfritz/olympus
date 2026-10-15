import { KEYS } from "@/lib/api/queries";

/** Everything the service and the shell keep about the CAs and their certificates. */
export const REFRESHED = (key: unknown) =>
  typeof key === "string" &&
  (key === KEYS.issuers ||
    key === KEYS.dashboard ||
    key === KEYS.lineages ||
    key.startsWith("/issuer/") ||
    key.startsWith("/certificate"));
