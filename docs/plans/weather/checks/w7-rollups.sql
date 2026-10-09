-- Sign-off W7.1 and W7.2: every tier's buckets for one hour of outdoor
-- temperature, against the same statistics computed straight from the
-- samples (count, sum, minimum, maximum; buckets on the epoch, as the
-- rollup functions bin them). Pass: for each tier, missing 0 and differ 0,
-- with 60, 12, 4, 2 and 1 buckets. Pick an hour within the samples' 48
-- hours that the 1h tier has built (an hour ending before the last few
-- minutes):
--
--   infra/docker/stack.sh compose data exec -T postgres \
--     psql -U postgres -d olympus -v ON_ERROR_STOP=1 \
--     -v from='2026-10-01 05:00:00+00' -v to='2026-10-01 06:00:00+00' \
--     < docs/plans/weather/checks/w7-rollups.sql

\if :{?from}
\else
  \echo 'usage: psql ... -v from=<start> -v to=<end> < w7-rollups.sql'
  \quit
\endif
\if :{?to}
\else
  \echo 'usage: psql ... -v from=<start> -v to=<end> < w7-rollups.sql'
  \quit
\endif

WITH tiers(tier, width) AS (
  SELECT name, bucket FROM olympus.weather_rollup_tiers
),
samples AS (
  SELECT t.tier, s.station_id,
         date_bin(t.width, s.observed_at, timestamptz 'epoch') AS bucket_start,
         count(*) AS n, sum(s.outdoor_temperature_f) AS total,
         min(s.outdoor_temperature_f) AS lo, max(s.outdoor_temperature_f) AS hi
  FROM tiers t
  JOIN olympus.weather_station_samples s
    ON s.observed_at >= :'from' AND s.observed_at < :'to'
   AND s.outdoor_temperature_f IS NOT NULL
  GROUP BY 1, 2, 3
),
rollups AS (
  SELECT r.tier, r.station_id, r.bucket_start, r.sample_count AS n,
         r.sum AS total, r.min AS lo, r.max AS hi
  FROM olympus.weather_station_rollups r
  JOIN olympus.weather_metrics m ON m.id = r.metric_id
  WHERE m.name = 'outdoor_temperature'
    AND r.bucket_start >= :'from' AND r.bucket_start < :'to'
)
SELECT tier,
       count(*) AS buckets,
       count(*) FILTER (WHERE s.n IS NULL OR r.n IS NULL) AS missing,
       count(*) FILTER (WHERE s.n <> r.n OR abs(s.total - r.total) > 1e-6
                          OR s.lo <> r.lo OR s.hi <> r.hi) AS differ
FROM samples s FULL JOIN rollups r USING (tier, station_id, bucket_start)
GROUP BY tier
ORDER BY array_position(ARRAY['1m', '5m', '15m', '30m', '1h'], tier);
