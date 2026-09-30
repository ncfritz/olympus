-- Station history in tiers (ADR 0024, plan phase 6). Samples are kept two
-- days; what lasts is one row per station, metric and bucket, holding the
-- bucket's count, sum, minimum, maximum, first and last, so each coarser
-- tier is computed exactly from the one below it. Like the samples, these
-- rows are rebuilt from the raw archive by replay and are left out of the
-- database backup.

-- What is rolled up. A reading the samples already have becomes a metric
-- with a row here, not a migration. `source` names a column of the samples
-- as the rollup sees them: the stored readings, plus rain_in (the amount
-- fallen since the previous sample) and wind_x_mph / wind_y_mph (the wind
-- as east-west and north-south components, so direction averages across
-- north). `rollup` is how a reader combines the statistics; every metric
-- stores all of them.
CREATE TABLE olympus.weather_metrics (
    id smallint GENERATED ALWAYS AS IDENTITY,
    name text NOT NULL,
    unit text NOT NULL,
    rollup text NOT NULL,
    source text NOT NULL,
    CONSTRAINT weather_metrics_rollup_check
        CHECK (rollup IN ('mean', 'sum', 'max', 'vector_x', 'vector_y')),
    CONSTRAINT weather_metrics_source_check CHECK (source IN (
        'outdoor_temperature_f', 'outdoor_humidity_pct',
        'indoor_temperature_f', 'indoor_humidity_pct',
        'dew_point_f', 'feels_like_f',
        'wind_speed_mph', 'wind_speed_avg_10m_mph', 'wind_gust_mph',
        'max_daily_gust_mph', 'wind_direction_deg',
        'wind_direction_avg_10m_deg', 'wind_x_mph', 'wind_y_mph',
        'rain_rate_in_hr', 'rain_in',
        'pressure_relative_inhg', 'pressure_absolute_inhg',
        'uv_index', 'solar_radiation_wm2'))
);

ALTER TABLE ONLY olympus.weather_metrics
    ADD CONSTRAINT weather_metrics_pkey PRIMARY KEY (id);

ALTER TABLE ONLY olympus.weather_metrics
    ADD CONSTRAINT weather_metrics_name_key UNIQUE (name);

INSERT INTO olympus.weather_metrics (name, unit, rollup, source) VALUES
    ('outdoor_temperature', 'F', 'mean', 'outdoor_temperature_f'),
    ('outdoor_humidity', '%', 'mean', 'outdoor_humidity_pct'),
    ('indoor_temperature', 'F', 'mean', 'indoor_temperature_f'),
    ('indoor_humidity', '%', 'mean', 'indoor_humidity_pct'),
    ('dew_point', 'F', 'mean', 'dew_point_f'),
    ('feels_like', 'F', 'mean', 'feels_like_f'),
    ('wind_speed', 'mph', 'mean', 'wind_speed_mph'),
    ('wind_gust', 'mph', 'max', 'wind_gust_mph'),
    ('wind_x', 'mph', 'vector_x', 'wind_x_mph'),
    ('wind_y', 'mph', 'vector_y', 'wind_y_mph'),
    ('rain', 'in', 'sum', 'rain_in'),
    ('rain_rate', 'in/h', 'max', 'rain_rate_in_hr'),
    ('pressure', 'inHg', 'mean', 'pressure_relative_inhg'),
    ('pressure_absolute', 'inHg', 'mean', 'pressure_absolute_inhg'),
    ('uv_index', 'index', 'max', 'uv_index'),
    ('solar_radiation', 'W/m2', 'mean', 'solar_radiation_wm2');

-- The tiers. `built_until`: every bucket of the tier that starts before it
-- has been built. The schedule carries on from there; a replay of old days
-- never moves it back.
CREATE TABLE olympus.weather_rollup_tiers (
    name text NOT NULL,
    bucket interval NOT NULL,
    retention interval,
    source_tier text,
    built_until timestamp with time zone,
    CONSTRAINT weather_rollup_tiers_bucket_check CHECK (bucket > interval '0'),
    CONSTRAINT weather_rollup_tiers_retention_check
        CHECK (retention IS NULL OR retention >= bucket)
);

ALTER TABLE ONLY olympus.weather_rollup_tiers
    ADD CONSTRAINT weather_rollup_tiers_pkey PRIMARY KEY (name);

ALTER TABLE ONLY olympus.weather_rollup_tiers
    ADD CONSTRAINT weather_rollup_tiers_source_tier_fkey FOREIGN KEY (source_tier)
    REFERENCES olympus.weather_rollup_tiers(name);

INSERT INTO olympus.weather_rollup_tiers (name, bucket, retention, source_tier) VALUES
    ('1m', interval '1 minute', interval '7 days', NULL),
    ('5m', interval '5 minutes', interval '30 days', '1m'),
    ('15m', interval '15 minutes', interval '90 days', '5m'),
    ('30m', interval '30 minutes', interval '180 days', '15m'),
    ('1h', interval '1 hour', NULL, '30m');

CREATE TABLE olympus.weather_station_rollups (
    station_id uuid NOT NULL,
    metric_id smallint NOT NULL,
    tier text NOT NULL,
    bucket_start timestamp with time zone NOT NULL,
    sample_count integer NOT NULL,
    sum double precision NOT NULL,
    min double precision NOT NULL,
    max double precision NOT NULL,
    first double precision NOT NULL,
    last double precision NOT NULL,
    CONSTRAINT weather_station_rollups_sample_count_check CHECK (sample_count > 0)
);

-- Also the index a series read uses: one station, one metric, one tier, a
-- range of buckets.
ALTER TABLE ONLY olympus.weather_station_rollups
    ADD CONSTRAINT weather_station_rollups_pkey
    PRIMARY KEY (station_id, metric_id, tier, bucket_start);

-- Pruning: a tier's buckets older than its retention, for every station.
CREATE INDEX weather_station_rollups_tier_bucket_start_idx
    ON olympus.weather_station_rollups (tier, bucket_start);

ALTER TABLE ONLY olympus.weather_station_rollups
    ADD CONSTRAINT weather_station_rollups_station_id_fkey FOREIGN KEY (station_id)
    REFERENCES olympus.weather_stations(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY olympus.weather_station_rollups
    ADD CONSTRAINT weather_station_rollups_metric_id_fkey FOREIGN KEY (metric_id)
    REFERENCES olympus.weather_metrics(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY olympus.weather_station_rollups
    ADD CONSTRAINT weather_station_rollups_tier_fkey FOREIGN KEY (tier)
    REFERENCES olympus.weather_rollup_tiers(name) ON UPDATE CASCADE ON DELETE CASCADE;

-- Never holds a row. Hasura exposes a function only if it returns a tracked
-- table's rows, so this is the rollup functions' return type (as
-- minerva.*_statistics_type is for the meeting statistics).
CREATE TABLE olympus.weather_rollup_results (
    tier text NOT NULL,
    rows_written integer NOT NULL,
    rows_pruned integer NOT NULL
);

ALTER TABLE ONLY olympus.weather_rollup_results
    ADD CONSTRAINT weather_rollup_results_pkey PRIMARY KEY (tier);

-- The 1m tier from the samples, for every whole minute in [from_time,
-- to_time) (both are taken down to their minute, and to_time to no later
-- than now). Each bucket is written
-- whole from every sample in it, so running it again rewrites rather than
-- adds.
--
-- Rain: the consoles report running totals; the amount in a sample is its
-- daily total less the previous sample's, and a drop means the total reset
-- at the console's midnight, so the new total is the amount. The previous
-- sample is looked for up to a day back; with none, the amount is 0.
CREATE FUNCTION olympus.weather_rollup_samples(from_time timestamp with time zone, to_time timestamp with time zone)
    RETURNS SETOF olympus.weather_rollup_results
    LANGUAGE plpgsql VOLATILE
    AS $$
DECLARE
    origin constant timestamp with time zone := timestamptz '1970-01-01 00:00:00+00';
    b_from timestamp with time zone := date_bin(interval '1 minute', from_time, origin);
    b_to timestamp with time zone := date_bin(interval '1 minute', to_time, origin);
    written integer;
BEGIN
    -- A minute that has not ended is not built, and built_until never
    -- runs ahead of the clock (a replay of today asks for the whole day).
    b_to := least(b_to, date_bin(interval '1 minute', now(), origin));
    WITH ordered AS (
        SELECT s.*,
               lag(s.rain_daily_in) OVER (PARTITION BY s.station_id ORDER BY s.observed_at) AS previous_rain_daily_in
        FROM olympus.weather_station_samples s
        WHERE s.observed_at >= b_from - interval '1 day'
          AND s.observed_at < b_to
    ), derived AS (
        SELECT o.*,
               CASE
                   WHEN o.rain_daily_in IS NULL THEN NULL
                   WHEN o.previous_rain_daily_in IS NULL THEN 0
                   WHEN o.rain_daily_in >= o.previous_rain_daily_in
                       THEN o.rain_daily_in - o.previous_rain_daily_in
                   ELSE o.rain_daily_in
               END AS rain_in,
               o.wind_speed_mph * sin(radians(o.wind_direction_deg)) AS wind_x_mph,
               o.wind_speed_mph * cos(radians(o.wind_direction_deg)) AS wind_y_mph
        FROM ordered o
        WHERE o.observed_at >= b_from
    ), readings AS (
        -- One row per sample and metric; to_jsonb picks the metric's column
        -- by name, so a new metric over an existing column is only a row.
        SELECT d.station_id,
               m.id AS metric_id,
               date_bin(interval '1 minute', d.observed_at, origin) AS bucket_start,
               d.observed_at,
               (to_jsonb(d) ->> m.source)::double precision AS value
        FROM derived d
        CROSS JOIN olympus.weather_metrics m
    )
    INSERT INTO olympus.weather_station_rollups
        (station_id, metric_id, tier, bucket_start, sample_count, sum, min, max, first, last)
    SELECT r.station_id, r.metric_id, '1m', r.bucket_start,
           count(*), sum(r.value), min(r.value), max(r.value),
           (array_agg(r.value ORDER BY r.observed_at))[1],
           (array_agg(r.value ORDER BY r.observed_at DESC))[1]
    FROM readings r
    WHERE r.value IS NOT NULL
    GROUP BY r.station_id, r.metric_id, r.bucket_start
    ON CONFLICT (station_id, metric_id, tier, bucket_start) DO UPDATE SET
        sample_count = excluded.sample_count,
        sum = excluded.sum,
        min = excluded.min,
        max = excluded.max,
        first = excluded.first,
        last = excluded.last;
    GET DIAGNOSTICS written = ROW_COUNT;

    UPDATE olympus.weather_rollup_tiers
    SET built_until = greatest(coalesce(built_until, b_to), b_to)
    WHERE name = '1m';

    RETURN QUERY SELECT '1m'::text, written, 0;
END;
$$;

-- A coarser tier from its source tier, for every whole bucket in
-- [from_time, to_time) (both taken down to the tier's bucket, and to_time
-- to no later than now). The same
-- rewrite-not-add rule: count and sum add up, minimum and maximum carry,
-- first and last come from the earliest and latest source buckets.
CREATE FUNCTION olympus.weather_rollup_tier(tier_name text, from_time timestamp with time zone, to_time timestamp with time zone)
    RETURNS SETOF olympus.weather_rollup_results
    LANGUAGE plpgsql VOLATILE
    AS $$
DECLARE
    origin constant timestamp with time zone := timestamptz '1970-01-01 00:00:00+00';
    tier_row olympus.weather_rollup_tiers;
    b_from timestamp with time zone;
    b_to timestamp with time zone;
    written integer;
BEGIN
    SELECT * INTO tier_row FROM olympus.weather_rollup_tiers WHERE name = tier_name;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No weather rollup tier named %', tier_name;
    END IF;
    IF tier_row.source_tier IS NULL THEN
        RAISE EXCEPTION 'Tier % is built from the samples: use weather_rollup_samples', tier_name;
    END IF;
    b_from := date_bin(tier_row.bucket, from_time, origin);
    b_to := least(date_bin(tier_row.bucket, to_time, origin),
                  date_bin(tier_row.bucket, now(), origin));

    INSERT INTO olympus.weather_station_rollups
        (station_id, metric_id, tier, bucket_start, sample_count, sum, min, max, first, last)
    SELECT r.station_id, r.metric_id, tier_name,
           date_bin(tier_row.bucket, r.bucket_start, origin) AS b,
           sum(r.sample_count), sum(r.sum), min(r.min), max(r.max),
           (array_agg(r.first ORDER BY r.bucket_start))[1],
           (array_agg(r.last ORDER BY r.bucket_start DESC))[1]
    FROM olympus.weather_station_rollups r
    WHERE r.tier = tier_row.source_tier
      AND r.bucket_start >= b_from
      AND r.bucket_start < b_to
    GROUP BY r.station_id, r.metric_id, b
    ON CONFLICT (station_id, metric_id, tier, bucket_start) DO UPDATE SET
        sample_count = excluded.sample_count,
        sum = excluded.sum,
        min = excluded.min,
        max = excluded.max,
        first = excluded.first,
        last = excluded.last;
    GET DIAGNOSTICS written = ROW_COUNT;

    UPDATE olympus.weather_rollup_tiers
    SET built_until = greatest(coalesce(built_until, b_to), b_to)
    WHERE name = tier_name;

    RETURN QUERY SELECT tier_name, written, 0;
END;
$$;

-- Retention: samples observed before sample_cutoff (the API passes now less
-- WEATHER_SAMPLE_RETENTION_HOURS, or earlier during a replay), and each
-- tier's buckets older than its retention. One row per tier, and one for
-- the samples.
CREATE FUNCTION olympus.weather_prune(sample_cutoff timestamp with time zone)
    RETURNS SETOF olympus.weather_rollup_results
    LANGUAGE plpgsql VOLATILE
    AS $$
DECLARE
    tier_row olympus.weather_rollup_tiers;
    pruned integer;
BEGIN
    DELETE FROM olympus.weather_station_samples WHERE observed_at < sample_cutoff;
    GET DIAGNOSTICS pruned = ROW_COUNT;
    RETURN QUERY SELECT 'samples'::text, 0, pruned;

    FOR tier_row IN
        SELECT * FROM olympus.weather_rollup_tiers WHERE retention IS NOT NULL ORDER BY bucket
    LOOP
        DELETE FROM olympus.weather_station_rollups
        WHERE tier = tier_row.name AND bucket_start < now() - tier_row.retention;
        GET DIAGNOSTICS pruned = ROW_COUNT;
        RETURN QUERY SELECT tier_row.name, 0, pruned;
    END LOOP;
END;
$$;
