/**
 * Derived readings, for the forecast (OpenWeather's free plan has no dew
 * point) and for a station push that lacks them. Fahrenheit and miles per
 * hour in and out, the units both sources use.
 */

/** Dew point from temperature and relative humidity (Magnus). */
export const dewPointF = (
  temperatureF: number,
  humidityPct: number,
): number => {
  const a = 17.62;
  const b = 243.12;
  const celsius = ((temperatureF - 32) * 5) / 9;
  const gamma =
    Math.log(Math.max(humidityPct, 1) / 100) + (a * celsius) / (b + celsius);
  return ((b * gamma) / (a - gamma)) * (9 / 5) + 32;
};

/**
 * What the temperature feels like, as the US National Weather Service
 * defines it: wind chill at 50 °F and below with wind over 3 mph, heat index
 * at 80 °F and above, the air temperature in between.
 */
export const feelsLikeF = (
  temperatureF: number,
  humidityPct: number,
  windSpeedMph: number,
): number => {
  if (temperatureF <= 50 && windSpeedMph > 3) {
    const v = windSpeedMph ** 0.16;
    return (
      35.74 + 0.6215 * temperatureF - 35.75 * v + 0.4275 * temperatureF * v
    );
  }
  if (temperatureF >= 80) return heatIndexF(temperatureF, humidityPct);
  return temperatureF;
};

/** The Rothfusz regression, with the NWS's low- and high-humidity adjustments. */
const heatIndexF = (t: number, rh: number): number => {
  let index =
    -42.379 +
    2.04901523 * t +
    10.14333127 * rh -
    0.22475541 * t * rh -
    0.00683783 * t * t -
    0.05481717 * rh * rh +
    0.00122874 * t * t * rh +
    0.00085282 * t * rh * rh -
    0.00000199 * t * t * rh * rh;
  if (rh < 13 && t <= 112) {
    index -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  } else if (rh > 85 && t <= 87) {
    index += ((rh - 85) / 10) * ((87 - t) / 5);
  }
  return index;
};
