-- What a forecast said about today after today's hours have passed (ADR
-- 0024). OpenWeather's free forecast starts at the next 3-hour step, so a
-- day built from it alone loses its morning as the day goes on: by the
-- evening, today's high and low are the evening's. These keep, per place,
-- the last forecast of every step and the temperatures observed, so today
-- is built from all of it. A place is a coordinate rounded to two decimal
-- places, the forecast cache's key: users who keep the same place share
-- one history. Kept two days; nothing else reads them, so they are not
-- worth restoring and a backup that holds them does no harm.

-- The last forecast of each 3-hour step: a later fetch replaces it.
CREATE TABLE olympus.weather_forecast_steps (
    latitude numeric(5,2) NOT NULL,
    longitude numeric(5,2) NOT NULL,
    step_at timestamp with time zone NOT NULL,
    temperature_f double precision NOT NULL,
    -- OpenWeather's probability of precipitation, 0 to 1.
    precipitation_chance double precision NOT NULL,
    -- Rain and snow (as water) over the step.
    precipitation_mm double precision NOT NULL,
    condition_id smallint NOT NULL,
    condition_main text NOT NULL,
    condition_description text NOT NULL,
    condition_icon text NOT NULL,
    fetched_at timestamp with time zone NOT NULL,
    CONSTRAINT weather_forecast_steps_precipitation_chance_check
        CHECK (precipitation_chance BETWEEN 0 AND 1)
);

ALTER TABLE ONLY olympus.weather_forecast_steps
    ADD CONSTRAINT weather_forecast_steps_pkey
    PRIMARY KEY (latitude, longitude, step_at);

-- The current temperature, as each fetch observed it.
CREATE TABLE olympus.weather_observed_temperatures (
    latitude numeric(5,2) NOT NULL,
    longitude numeric(5,2) NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    temperature_f double precision NOT NULL
);

ALTER TABLE ONLY olympus.weather_observed_temperatures
    ADD CONSTRAINT weather_observed_temperatures_pkey
    PRIMARY KEY (latitude, longitude, observed_at);

-- Pruning is by time alone, across places.
CREATE INDEX weather_forecast_steps_step_at_idx
    ON olympus.weather_forecast_steps (step_at);
CREATE INDEX weather_observed_temperatures_observed_at_idx
    ON olympus.weather_observed_temperatures (observed_at);
