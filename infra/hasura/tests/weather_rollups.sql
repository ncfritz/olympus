-- Checks for the weather rollup functions (migration
-- 1790740000000_weather_rollups), against hand-computed buckets. Runs in a
-- transaction that is rolled back, so it is safe on any database with the
-- migrations applied, and fails loudly on the first wrong value:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/weather_rollups.sql <database>
--
-- The dates are in the past, so the functions' "not after now" limit never
-- trims them.

\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.expect(label text, actual double precision, expected double precision)
    RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF actual IS DISTINCT FROM expected
       AND (actual IS NULL OR expected IS NULL OR abs(actual - expected) > 1e-9) THEN
        RAISE EXCEPTION '%: expected %, got %', label, expected, actual;
    END IF;
END;
$$;

CREATE FUNCTION pg_temp.stat(metric text, tier_name text, bucket timestamptz, statistic text)
    RETURNS double precision LANGUAGE plpgsql AS $$
DECLARE
    result double precision;
BEGIN
    EXECUTE format(
        'SELECT r.%I::double precision FROM olympus.weather_station_rollups r
           JOIN olympus.weather_metrics m ON m.id = r.metric_id
          WHERE m.name = $1 AND r.tier = $2 AND r.bucket_start = $3',
        statistic)
    INTO result USING metric, tier_name, bucket;
    RETURN result;
END;
$$;

INSERT INTO olympus.weather_stations (id, name, mac_address)
VALUES ('00000000-0000-4000-8000-00000000e5e5', 'Rollup test', 'e5:e5:e5:e5:e5:e5');

-- 12:00 has three samples; the daily rain total resets between 12:00 and
-- 12:01; the wind swings across north at 12:00 (350°, 10°, 10°).
INSERT INTO olympus.weather_station_samples
    (station_id, observed_at, source, outdoor_temperature_f, rain_daily_in,
     wind_speed_mph, wind_direction_deg, wind_gust_mph)
VALUES
    ('00000000-0000-4000-8000-00000000e5e5', '2026-01-10 11:59:50+00', 'push', 50, 0.10, 10, 350, 12),
    ('00000000-0000-4000-8000-00000000e5e5', '2026-01-10 12:00:05+00', 'push', 60, 0.12, 10, 350, 15),
    ('00000000-0000-4000-8000-00000000e5e5', '2026-01-10 12:00:21+00', 'push', 62, 0.15, 10, 10, 11),
    ('00000000-0000-4000-8000-00000000e5e5', '2026-01-10 12:00:37+00', 'push', 58, 0.15, 10, 10, 14),
    ('00000000-0000-4000-8000-00000000e5e5', '2026-01-10 12:01:10+00', 'push', 57, 0.01, 0, NULL, 3),
    ('00000000-0000-4000-8000-00000000e5e5', '2026-01-10 12:04:59+00', 'push', 55, 0.03, 5, 180, 6);

SELECT * FROM olympus.weather_rollup_samples('2026-01-10 12:00:00+00', '2026-01-10 12:05:00+00');

DO $$
DECLARE
    m0 constant timestamptz := '2026-01-10 12:00:00+00';
    m1 constant timestamptz := '2026-01-10 12:01:00+00';
BEGIN
    -- Temperature: count, sum, minimum, maximum, first, last.
    PERFORM pg_temp.expect('temperature count', pg_temp.stat('outdoor_temperature', '1m', m0, 'sample_count'), 3);
    PERFORM pg_temp.expect('temperature sum', pg_temp.stat('outdoor_temperature', '1m', m0, 'sum'), 180);
    PERFORM pg_temp.expect('temperature min', pg_temp.stat('outdoor_temperature', '1m', m0, 'min'), 58);
    PERFORM pg_temp.expect('temperature max', pg_temp.stat('outdoor_temperature', '1m', m0, 'max'), 62);
    PERFORM pg_temp.expect('temperature first', pg_temp.stat('outdoor_temperature', '1m', m0, 'first'), 60);
    PERFORM pg_temp.expect('temperature last', pg_temp.stat('outdoor_temperature', '1m', m0, 'last'), 58);
    -- The 11:59:50 sample is before the range: only the rain looks at it.
    PERFORM pg_temp.expect('no 11:59 bucket', pg_temp.stat('outdoor_temperature', '1m', '2026-01-10 11:59:00+00', 'sum'), NULL);

    -- Rain: 0.02 + 0.03 + 0 from the running total; then a reset, so 0.01.
    PERFORM pg_temp.expect('rain 12:00', pg_temp.stat('rain', '1m', m0, 'sum'), 0.05);
    PERFORM pg_temp.expect('rain 12:01 after reset', pg_temp.stat('rain', '1m', m1, 'sum'), 0.01);

    -- Wind across north: east-west cancels to one 10° sample's worth;
    -- north-south is all positive. A calm with no direction has no vector.
    PERFORM pg_temp.expect('wind x', pg_temp.stat('wind_x', '1m', m0, 'sum'), 10 * sin(radians(10)));
    PERFORM pg_temp.expect('wind y', pg_temp.stat('wind_y', '1m', m0, 'sum'), 30 * cos(radians(10)));
    PERFORM pg_temp.expect('no vector for a calm', pg_temp.stat('wind_x', '1m', m1, 'sample_count'), NULL);
    PERFORM pg_temp.expect('calm still a speed', pg_temp.stat('wind_speed', '1m', m1, 'sum'), 0);

    -- Gusts roll up by their maximum.
    PERFORM pg_temp.expect('gust max', pg_temp.stat('wind_gust', '1m', m0, 'max'), 15);
END;
$$;

-- Running it again rewrites rather than adds.
SELECT * FROM olympus.weather_rollup_samples('2026-01-10 12:00:30+00', '2026-01-10 12:05:00+00');
DO $$
BEGIN
    PERFORM pg_temp.expect('rerun count', pg_temp.stat('outdoor_temperature', '1m', '2026-01-10 12:00:00+00', 'sample_count'), 3);
    PERFORM pg_temp.expect('rerun sum', pg_temp.stat('outdoor_temperature', '1m', '2026-01-10 12:00:00+00', 'sum'), 180);
END;
$$;

-- A tier from its source tier equals the same statistics from the samples.
SELECT * FROM olympus.weather_rollup_tier('5m', '2026-01-10 12:00:00+00', '2026-01-10 12:05:00+00');
DO $$
DECLARE
    b constant timestamptz := '2026-01-10 12:00:00+00';
BEGIN
    PERFORM pg_temp.expect('5m count', pg_temp.stat('outdoor_temperature', '5m', b, 'sample_count'), 5);
    PERFORM pg_temp.expect('5m sum', pg_temp.stat('outdoor_temperature', '5m', b, 'sum'), 292);
    PERFORM pg_temp.expect('5m min', pg_temp.stat('outdoor_temperature', '5m', b, 'min'), 55);
    PERFORM pg_temp.expect('5m max', pg_temp.stat('outdoor_temperature', '5m', b, 'max'), 62);
    PERFORM pg_temp.expect('5m first', pg_temp.stat('outdoor_temperature', '5m', b, 'first'), 60);
    PERFORM pg_temp.expect('5m last', pg_temp.stat('outdoor_temperature', '5m', b, 'last'), 55);
    PERFORM pg_temp.expect('5m rain', pg_temp.stat('rain', '5m', b, 'sum'), 0.08);
END;
$$;

-- A replay of an older range never moves built_until back.
SELECT * FROM olympus.weather_rollup_samples('2025-12-01 00:00:00+00', '2025-12-01 00:05:00+00');
DO $$
BEGIN
    IF (SELECT built_until FROM olympus.weather_rollup_tiers WHERE name = '1m')
       < '2026-01-10 12:05:00+00' THEN
        RAISE EXCEPTION 'built_until moved back';
    END IF;
END;
$$;

-- Building never runs ahead of the clock.
SELECT * FROM olympus.weather_rollup_samples(now() - interval '1 hour', now() + interval '1 day');
DO $$
BEGIN
    IF (SELECT built_until FROM olympus.weather_rollup_tiers WHERE name = '1m') > now() THEN
        RAISE EXCEPTION 'built_until is in the future';
    END IF;
END;
$$;

-- Pruning: samples before the cutoff; these 2026-01 buckets are older than
-- the 1m and 5m retentions.
SELECT * FROM olympus.weather_prune('2026-01-10 12:01:00+00');
DO $$
BEGIN
    PERFORM pg_temp.expect('samples left',
        (SELECT count(*) FROM olympus.weather_station_samples
          WHERE station_id = '00000000-0000-4000-8000-00000000e5e5'), 2);
    PERFORM pg_temp.expect('1m pruned', pg_temp.stat('outdoor_temperature', '1m', '2026-01-10 12:00:00+00', 'sum'), NULL);
    PERFORM pg_temp.expect('5m pruned', pg_temp.stat('outdoor_temperature', '5m', '2026-01-10 12:00:00+00', 'sum'), NULL);
END;
$$;

DO $$
BEGIN
    PERFORM olympus.weather_rollup_tier('1m', now(), now());
    RAISE EXCEPTION 'the 1m tier was built from a tier';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%use weather_rollup_samples%' THEN RAISE; END IF;
END;
$$;

\echo weather rollups: all checks passed
ROLLBACK;
