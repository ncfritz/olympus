DROP FUNCTION IF EXISTS olympus.weather_prune(timestamp with time zone);
DROP FUNCTION IF EXISTS olympus.weather_rollup_tier(text, timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS olympus.weather_rollup_samples(timestamp with time zone, timestamp with time zone);
DROP TABLE IF EXISTS olympus.weather_rollup_results;
DROP TABLE IF EXISTS olympus.weather_station_rollups;
DROP TABLE IF EXISTS olympus.weather_rollup_tiers;
DROP TABLE IF EXISTS olympus.weather_metrics;
