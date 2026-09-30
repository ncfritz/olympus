export const WEATHER_STATION = `id
  name
  macAddress
  createdTime
  lastUpdatedTime`;

/** A sample's reading, as the station views show it. */
export const WEATHER_STATION_READING = `observedTime
  source
  outdoorTemperatureF
  outdoorHumidityPct
  indoorTemperatureF
  indoorHumidityPct
  dewPointF
  feelsLikeF
  windSpeedMph
  windSpeedAvg10mMph
  windGustMph
  maxDailyGustMph
  windDirectionDeg
  windDirectionAvg10mDeg
  rainRateInHr
  rainEventIn
  rainDailyIn
  rainWeeklyIn
  rainMonthlyIn
  rainYearlyIn
  pressureRelativeInhg
  pressureAbsoluteInhg
  uvIndex
  solarRadiationWm2
  batteryOutdoorOk
  batteryIndoorOk`;

/** A station with its newest sample, for listing and describing. */
export const WEATHER_STATION_WITH_LATEST = `${WEATHER_STATION}
  samples(order_by: { observedTime: desc }, limit: 1) {
    ${WEATHER_STATION_READING}
  }`;
