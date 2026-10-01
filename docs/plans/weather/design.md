# Weather: widget design

The screens for [ADR 0024](../../decisions/0024-weather-providers.md),
drawn on the [design canvas](https://claude.ai/artifact/CHZV46vwWbXJ7rSmejX2ib).
Readings and names on the canvas are sample data.

## The widget

The home page's right-hand column, as today. A card with the site's
`#004673` header rule and two views, **Forecast** and **Stations**,
switched in the header.

### Forecast

For one location at a time; the location menu in the header changes it,
and every panel below follows.

| Panel         | Content                                                                                                                                                                    | Source (OpenWeather, free plan) |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Now           | Icon, temperature, condition, feels like, today's high and low; wind and gust, humidity and dew point, pressure, visibility and cloud cover; updated time, sunrise, sunset | Current Weather                 |
| Next 24 hours | Eight 3-hour steps: time, icon, a curve of the picked measure (temperature, feels like, humidity or pressure) with each step's value, chance of precipitation              | 5 day / 3 hour Forecast         |
| 5 days        | Per local day: icon, chance of precipitation, low, a range bar on a shared scale, high                                                                                     | 5 day / 3 hour, grouped by day  |
| Map           | Google map, greyscale style, centred on the location, **zoom 8, fixed**, no gestures                                                                                       | Weather Maps 1.0; RainViewer    |
| Footer        | Attribution: OpenWeather, RainViewer                                                                                                                                       | —                               |

Map layers, one at a time: **Radar** (default), Precipitation,
Temperature, Clouds, Wind, Pressure. Radar has a play button and a
scrubber over the past two hours in 10-minute frames, ending at now, and
a light-to-heavy legend. The other layers are a single frame.

Units are imperial (°F, mph, inHg, in), with hPa beside pressure.

### Location menu and management

- The header's location button opens a menu of the user's locations in
  their order, the current one checked and the default tagged; the last
  item opens **Weather locations**.
- **Weather locations** (a modal): a Google Places Autocomplete search
  ("Powered by Google" under the suggestions); choosing a suggestion adds
  it under its Google name, which the user can relabel. Each row has a
  drag handle, the label, the Google place under it, a default radio and
  remove. Changes save as they are made.
- The widget opens on the default location, or the first if none is
  marked. The last location picked in a session is kept in the page, not
  saved.

### Stations

One card per registered station: name, reporting state and age of the
last reading, outdoor temperature with a 24-hour sparkline and its low
and high, and a grid of feels like, dew point, humidity, wind, gust,
pressure, rain rate, rain today, UV and solar, indoor temperature and
humidity, and battery. **History** in the header opens the station page.

## Station history page

`/weather/stations`: choose a station (or compare both) and a range:
presets for 24 hours, 7, 30 and 90 days, a year and everything, or any
dates in a range picker. The resolution follows the range (the finest
tier that still holds the whole range and keeps a chart to about 2,000
points) and can be overridden where a finer tier covers the range. A row
of summary tiles, then charts: temperature with dew point, indoor
temperature and humidity, outdoor humidity, wind speed with gust,
pressure, rain per bucket and solar radiation. Each line is the bucket's
average with its minimum–maximum as a band.

The history is meant to sit beside other historical data later, so the
operation behind the page is general: any station, any metrics, any
range, a resolution or `auto`. The page is its first user, not its only
one.

## States

| State                 | Shown as                                                                                |
| --------------------- | --------------------------------------------------------------------------------------- |
| Loading               | Skeleton blocks in each panel's place                                                   |
| Provider down         | The last good data, with a warning naming its time; the server retries                  |
| A map layer failing   | The base map, with a note over it; the rest of the widget is unaffected                 |
| No locations          | An empty card with **Add a location**                                                   |
| Station not reporting | After 10 minutes without a push: greyed last reading, the time of it, and what to check |
