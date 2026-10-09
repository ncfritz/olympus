-- The house's weather stations and what they push (ADR 0024). A station is
-- known by its console's MAC address, which is also the PASSKEY its
-- Customized upload sends; nothing is accepted from one not listed here.

CREATE TABLE olympus.weather_stations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    mac_address macaddr NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weather_stations_name_check CHECK (length(btrim(name)) > 0)
);

ALTER TABLE ONLY olympus.weather_stations
    ADD CONSTRAINT weather_stations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY olympus.weather_stations
    ADD CONSTRAINT weather_stations_mac_address_key UNIQUE (mac_address);

CREATE TRIGGER set_olympus_weather_stations_updated_at BEFORE UPDATE ON olympus.weather_stations
    FOR EACH ROW EXECUTE FUNCTION olympus.set_current_timestamp_updated_at();

-- One row per push (or backfilled record), a column per reading, in the
-- console's own units. Kept for WEATHER_SAMPLE_RETENTION_HOURS: the rollups
-- (phase 6) are the history, and the raw archive on disk is the source of
-- truth, so this table is left out of the database backup.
CREATE TABLE olympus.weather_station_samples (
    id bigint GENERATED ALWAYS AS IDENTITY,
    station_id uuid NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    source text NOT NULL,
    outdoor_temperature_f double precision,
    outdoor_humidity_pct double precision,
    indoor_temperature_f double precision,
    indoor_humidity_pct double precision,
    dew_point_f double precision,
    feels_like_f double precision,
    wind_speed_mph double precision,
    wind_speed_avg_10m_mph double precision,
    wind_gust_mph double precision,
    max_daily_gust_mph double precision,
    wind_direction_deg double precision,
    wind_direction_avg_10m_deg double precision,
    rain_rate_in_hr double precision,
    rain_event_in double precision,
    rain_daily_in double precision,
    rain_weekly_in double precision,
    rain_monthly_in double precision,
    rain_yearly_in double precision,
    pressure_relative_inhg double precision,
    pressure_absolute_inhg double precision,
    uv_index double precision,
    solar_radiation_wm2 double precision,
    battery_outdoor_ok boolean,
    battery_indoor_ok boolean,
    CONSTRAINT weather_station_samples_source_check CHECK (source IN ('push', 'backfill'))
);

ALTER TABLE ONLY olympus.weather_station_samples
    ADD CONSTRAINT weather_station_samples_pkey PRIMARY KEY (id);

-- A console repeating itself stores one row; also the index every read uses.
ALTER TABLE ONLY olympus.weather_station_samples
    ADD CONSTRAINT weather_station_samples_station_id_observed_at_key UNIQUE (station_id, observed_at);

ALTER TABLE ONLY olympus.weather_station_samples
    ADD CONSTRAINT weather_station_samples_station_id_fkey FOREIGN KEY (station_id)
    REFERENCES olympus.weather_stations(id) ON UPDATE CASCADE ON DELETE CASCADE;
