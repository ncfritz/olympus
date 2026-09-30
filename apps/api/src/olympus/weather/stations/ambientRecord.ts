import moment from "moment";
import type { AmbientRecord } from "../providers/ambientTypes";

/**
 * An ambientweather.net record as the Customized upload's query, so
 * parseAmbientReport reads it (plan phase 7): the field names are the
 * same, the values become text, `dateutc` (epoch milliseconds, or an ISO
 * time) becomes the upload's `YYYY-MM-DD HH:mm:ss`, and the station's MAC
 * is its PASSKEY. Undefined for a record without a usable time.
 */
export const recordToQuery = (
  macAddress: string,
  record: unknown,
): Record<string, string> | undefined => {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return undefined;
  }
  const { dateutc, ...fields } = record as AmbientRecord;
  const at =
    typeof dateutc === "number"
      ? moment.utc(dateutc)
      : typeof dateutc === "string"
        ? moment.utc(dateutc, moment.ISO_8601, true)
        : undefined;
  if (!at?.isValid()) return undefined;

  const query: Record<string, string> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      query[name] = String(value);
    } else if (typeof value === "string") {
      query[name] = value;
    }
  }
  query.PASSKEY = macAddress;
  query.dateutc = at.format("YYYY-MM-DD HH:mm:ss");
  return query;
};
