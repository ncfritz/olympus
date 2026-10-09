/**
 * One record of ambientweather.net's device data: the same field names as
 * the Customized upload (tempf, humidity, windspeedmph, ...), as numbers,
 * with `dateutc` in epoch milliseconds.
 */
export type AmbientRecord = {
  dateutc: number | string;
  [field: string]: unknown;
};
