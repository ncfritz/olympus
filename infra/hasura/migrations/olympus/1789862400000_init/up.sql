-- Baseline: the schema as it was on 2026-09-20 (pg_dump --schema-only),
-- without its DROP statements and without ownership. The pg_dump 17
-- preamble keeps its SET statements, minus transaction_timeout, which
-- PostgreSQL 16 does not know; check_function_bodies must stay off,
-- because functions are created before the tables they read.

--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3 (Debian 16.3-1.pgdg120+1)
-- Dumped by pg_dump version 17.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA dionysus;



--
-- Name: minerva; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA minerva;



--
-- Name: olympus; Type: SCHEMA; Schema: -; Owner: olympus
--

CREATE SCHEMA olympus;



--
-- Name: set_current_timestamp_updated_at(); Type: FUNCTION; Schema: dionysus; Owner: postgres
--

CREATE FUNCTION dionysus.set_current_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$;



SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: meeting_day_statistics_type; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.meeting_day_statistics_type (
    day text NOT NULL,
    status text NOT NULL,
    duration numeric NOT NULL,
    count numeric NOT NULL
);



--
-- Name: meeting_day_statistics(timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: minerva; Owner: postgres
--

CREATE FUNCTION minerva.meeting_day_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_day_statistics_type
    LANGUAGE sql STABLE
    AS $$
select 
    to_char(
        minerva.meetings.start_time at time zone tz,
        'D' :: text
    ) AS day,
    status, 
    sum(duration) as duration, 
    count(*) 
from minerva.meetings
where all_day=false and cancelled=false
and 
start_time >= start_date
  AND end_time <= end_date
group by day, status
$$;



--
-- Name: meeting_hour_statistics_type; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.meeting_hour_statistics_type (
    hour text NOT NULL,
    status text,
    duration numeric,
    count numeric
);



--
-- Name: meeting_hour_statistics(timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: minerva; Owner: postgres
--

CREATE FUNCTION minerva.meeting_hour_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_hour_statistics_type
    LANGUAGE sql STABLE
    AS $$
select 
    to_char(
        minerva.meetings.start_time at time zone tz,
        'HH24' :: text
    ) AS hour,
    status, 
    sum(duration) as duration, 
    count(*) 
from minerva.meetings
where all_day=false and cancelled=false
and 
start_time >= start_date
  AND end_time <= end_date
group by hour, status
$$;



--
-- Name: meeting_status_statistics_type; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.meeting_status_statistics_type (
    start_date text NOT NULL,
    status text NOT NULL,
    duration numeric NOT NULL,
    count numeric NOT NULL
);



--
-- Name: meeting_status_statistics(timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: minerva; Owner: postgres
--

CREATE FUNCTION minerva.meeting_status_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text) RETURNS SETOF minerva.meeting_status_statistics_type
    LANGUAGE sql STABLE
    AS $$
select 
    to_char(
        minerva.meetings.start_time at time zone tz,
        'YYYY-MM-DD' :: text
    ) AS start_date,
    status, 
    sum(duration), 
    count(*) 
from minerva.meetings
where all_day=false and cancelled=false
and 
start_time >= start_date
  AND end_time <= end_date
group by start_date, status
$$;



--
-- Name: notes_hour_statistics_type; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.notes_hour_statistics_type (
    created text NOT NULL,
    hour text NOT NULL,
    type numeric NOT NULL,
    count numeric NOT NULL
);



--
-- Name: notes_hour_statistics(timestamp with time zone, timestamp with time zone, text, boolean); Type: FUNCTION; Schema: minerva; Owner: olympus
--

CREATE FUNCTION minerva.notes_hour_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text, parent_only boolean DEFAULT true) RETURNS SETOF minerva.notes_hour_statistics_type
    LANGUAGE sql STABLE
    AS $$
SELECT
  to_char(
    minerva.notes.created_at at time zone tz,
    'YYYY-MM-DD' :: text
  ) AS created,
  to_char(
    minerva.notes.created_at at time zone tz,
    'HH' :: text
  ) AS hour,
  minerva.notes.type,
  count(*) AS count
FROM
  minerva.notes
  WHERE
notes.created_at >= start_date
  AND notes.created_at <= end_date
  AND CASE WHEN parent_only THEN notes.parent_id is NULL END
GROUP BY
  created,
  hour,
  notes.type $$;



--
-- Name: notes_type_statistics_type; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.notes_type_statistics_type (
    created text NOT NULL,
    type numeric NOT NULL,
    count numeric NOT NULL
);



--
-- Name: notes_type_statistics(timestamp with time zone, timestamp with time zone, text, boolean); Type: FUNCTION; Schema: minerva; Owner: olympus
--

CREATE FUNCTION minerva.notes_type_statistics(start_date timestamp with time zone, end_date timestamp with time zone, tz text DEFAULT 'Etc/UTC'::text, parent_only boolean DEFAULT true) RETURNS SETOF minerva.notes_type_statistics_type
    LANGUAGE sql STABLE
    AS $$
SELECT
  to_char(
    notes.created_at at time zone tz,
    'YYYY-MM-DD' :: text
  ) AS created,
  notes.type,
  count(*) AS count
FROM
  minerva.notes
WHERE
  notes.created_at >= start_date
  AND notes.created_at <= end_date
  AND CASE WHEN parent_only THEN notes.parent_id is NULL END
GROUP BY
  created,
  notes.type $$;



--
-- Name: set_current_timestamp_updated_at(); Type: FUNCTION; Schema: minerva; Owner: postgres
--

CREATE FUNCTION minerva.set_current_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$;



--
-- Name: set_current_timestamp_updated_at(); Type: FUNCTION; Schema: olympus; Owner: olympus
--

CREATE FUNCTION olympus.set_current_timestamp_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$;



--
-- Name: bulk_load_jobs; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.bulk_load_jobs (
    job_id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type character varying NOT NULL,
    status character varying DEFAULT 'created'::character varying,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    total_records numeric DEFAULT 0 NOT NULL,
    duplicate_records numeric DEFAULT 0 NOT NULL,
    noop_records numeric DEFAULT 0 NOT NULL,
    new_records numeric DEFAULT '0'::numeric NOT NULL,
    expired_records numeric DEFAULT '0'::numeric,
    processed_records numeric DEFAULT '0'::numeric,
    skipped_records numeric DEFAULT '0'::numeric,
    max_record_to_process numeric
);



--
-- Name: TABLE bulk_load_jobs; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TABLE dionysus.bulk_load_jobs IS 'Tracks the state of bulk loads from TMDB';


--
-- Name: bulk_load_jobs_statistics; Type: VIEW; Schema: dionysus; Owner: postgres
--

CREATE VIEW dionysus.bulk_load_jobs_statistics AS
 SELECT type,
    to_char(created_at, 'yyyy-mm-dd'::text) AS created_date,
    (sum(total_records) / (count(*))::numeric) AS total_records,
    (sum(duplicate_records) / (count(*))::numeric) AS duplicate_records,
    (sum(noop_records) / (count(*))::numeric) AS noop_records,
    (sum(new_records) / (count(*))::numeric) AS new_records,
    (sum(expired_records) / (count(*))::numeric) AS expired_records,
    (sum(processed_records) / (count(*))::numeric) AS processed_records,
    (sum(skipped_records) / (count(*))::numeric) AS skipped_records,
    ((sum(EXTRACT(epoch FROM (COALESCE(started_at, now()) - created_at))))::double precision / (count(*))::double precision) AS queue_time,
    ((sum(EXTRACT(epoch FROM (COALESCE(finished_at, now()) - started_at))))::double precision / (count(*))::double precision) AS run_time,
    count(*) AS count
   FROM dionysus.bulk_load_jobs
  WHERE (created_at > (now() - '30 days'::interval))
  GROUP BY type, (to_char(created_at, 'yyyy-mm-dd'::text))
  ORDER BY (to_char(created_at, 'yyyy-mm-dd'::text)) DESC;



--
-- Name: bulk_load_jobs_status_statistics; Type: VIEW; Schema: dionysus; Owner: postgres
--

CREATE VIEW dionysus.bulk_load_jobs_status_statistics AS
 SELECT type,
    status,
    count(*) AS count
   FROM dionysus.bulk_load_jobs
  WHERE (created_at > (now() - '30 days'::interval))
  GROUP BY type, status;



--
-- Name: certifications; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.certifications (
    country text NOT NULL,
    certification text NOT NULL,
    type text NOT NULL,
    "order" numeric NOT NULL,
    meaning text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: TABLE certifications; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TABLE dionysus.certifications IS 'Movie and TV certifications';


--
-- Name: collection_images; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.collection_images (
    collection_id numeric NOT NULL,
    type text NOT NULL,
    file_path text NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    iso_639_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: collection_parts; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.collection_parts (
    collection_id numeric NOT NULL,
    movie_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: collections; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.collections (
    id numeric NOT NULL,
    name text NOT NULL,
    overview text NOT NULL,
    poster_path text,
    backdrop_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: content_asset_channel; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.content_asset_channel (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    filter_input text NOT NULL,
    encoded_filter text NOT NULL,
    ttl numeric NOT NULL,
    jitter numeric NOT NULL,
    last_fetched_at timestamp with time zone NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    favorite boolean DEFAULT false NOT NULL,
    bc_compliant boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    asset_count numeric DEFAULT '0'::numeric NOT NULL
);



--
-- Name: content_asset_channel_cache; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.content_asset_channel_cache (
    channel_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    width numeric,
    height numeric
);



--
-- Name: content_asset_channel_category; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.content_asset_channel_category (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: content_assets; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.content_assets (
    content_id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    original_name text NOT NULL,
    original_sha text NOT NULL,
    asset_sha text NOT NULL,
    duration numeric NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    name text,
    rating numeric DEFAULT '0'::numeric NOT NULL,
    original_size numeric DEFAULT '0'::numeric NOT NULL,
    asset_size numeric DEFAULT '0'::numeric NOT NULL,
    fevorite boolean DEFAULT false
);



--
-- Name: TABLE content_assets; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TABLE dionysus.content_assets IS 'Transcoded assets for the content section';


--
-- Name: content_asset_duplicates; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.content_asset_duplicates AS
 SELECT duration,
    content_id,
    width,
    height,
    original_size,
    asset_size
   FROM dionysus.content_assets
  WHERE (duration IN ( SELECT unnamed_subquery.duration
           FROM ( SELECT content_assets_1.duration,
                    count(*) AS cnt
                   FROM dionysus.content_assets content_assets_1
                  GROUP BY content_assets_1.duration) unnamed_subquery
          WHERE (unnamed_subquery.cnt > 1)))
  ORDER BY duration DESC;



--
-- Name: content_asset_duration_statistics; Type: VIEW; Schema: dionysus; Owner: postgres
--

CREATE VIEW dionysus.content_asset_duration_statistics AS
 WITH options AS (
         SELECT round(((max(((content_assets_1.duration / (1000)::numeric) / (60)::numeric)) - min(((content_assets_1.duration / (1000)::numeric) / (60)::numeric))) / (50)::numeric)) AS bw
           FROM dionysus.content_assets content_assets_1
        )
 SELECT (round((((content_assets.duration / (1000)::numeric) / (60)::numeric) / options.bw)) * options.bw) AS bucket,
    count(1) AS count,
    options.bw AS bucket_width
   FROM dionysus.content_assets,
    options
  GROUP BY (round((((content_assets.duration / (1000)::numeric) / (60)::numeric) / options.bw)) * options.bw), options.bw;



--
-- Name: content_asset_height_statistics; Type: VIEW; Schema: dionysus; Owner: postgres
--

CREATE VIEW dionysus.content_asset_height_statistics AS
 WITH options AS (
         SELECT round(((max(content_assets_1.height) - min(content_assets_1.height)) / (50)::numeric)) AS bw
           FROM dionysus.content_assets content_assets_1
        )
 SELECT (round((content_assets.height / options.bw)) * options.bw) AS bucket,
    count(1) AS count,
    options.bw AS bucket_width
   FROM dionysus.content_assets,
    options
  GROUP BY (round((content_assets.height / options.bw)) * options.bw), options.bw;



--
-- Name: content_asset_ingest_workflows; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.content_asset_ingest_workflows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    temp_location text,
    status text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_type text
);



--
-- Name: content_asset_ingest_workflow_source_aggregate; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.content_asset_ingest_workflow_source_aggregate AS
 SELECT source_type,
    count(*) AS count
   FROM dionysus.content_asset_ingest_workflows
  GROUP BY source_type;



--
-- Name: content_asset_ingest_workflow_status_aggregate; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.content_asset_ingest_workflow_status_aggregate AS
 SELECT status,
    count(*) AS count
   FROM dionysus.content_asset_ingest_workflows
  GROUP BY status;



--
-- Name: content_asset_ingest_workflow_status_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.content_asset_ingest_workflow_status_statistics AS
 SELECT to_char(created_at, 'yyyy-mm-dd'::text) AS created_date,
    status,
    count(*) AS count
   FROM dionysus.content_asset_ingest_workflows
  WHERE (created_at > (now() - '30 days'::interval))
  GROUP BY (to_char(created_at, 'yyyy-mm-dd'::text)), status;



--
-- Name: content_asset_ingest_workflow_steps; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.content_asset_ingest_workflow_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    progress numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: content_asset_jobs; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.content_asset_jobs (
    content_id uuid NOT NULL,
    job_type text NOT NULL,
    status text NOT NULL,
    started_time timestamp with time zone,
    completed_time timestamp with time zone,
    steps_total numeric DEFAULT 0 NOT NULL,
    completed_steps numeric DEFAULT 0 NOT NULL,
    failed_steps numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: content_asset_size_statistics; Type: VIEW; Schema: dionysus; Owner: postgres
--

CREATE VIEW dionysus.content_asset_size_statistics AS
 WITH options AS (
         SELECT round(((max(content_assets_1.asset_size) - min(content_assets_1.asset_size)) / (50)::numeric)) AS bw
           FROM dionysus.content_assets content_assets_1
        )
 SELECT (round((content_assets.asset_size / options.bw)) * options.bw) AS bucket,
    count(1) AS count,
    options.bw AS bucket_width
   FROM dionysus.content_assets,
    options
  GROUP BY (round((content_assets.asset_size / options.bw)) * options.bw), options.bw;



--
-- Name: content_asset_tags; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.content_asset_tags (
    content_id uuid NOT NULL,
    content_tag_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);



--
-- Name: TABLE content_asset_tags; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TABLE dionysus.content_asset_tags IS 'Tag mapping table for content assets';


--
-- Name: content_asset_width_statistics; Type: VIEW; Schema: dionysus; Owner: postgres
--

CREATE VIEW dionysus.content_asset_width_statistics AS
 WITH options AS (
         SELECT round(((max(content_assets_1.width) - min(content_assets_1.width)) / (50)::numeric)) AS bw
           FROM dionysus.content_assets content_assets_1
        )
 SELECT (round((content_assets.width / options.bw)) * options.bw) AS bucket,
    count(1) AS count,
    options.bw AS bucket_width
   FROM dionysus.content_assets,
    options
  GROUP BY (round((content_assets.width / options.bw)) * options.bw), options.bw;



--
-- Name: content_auth; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.content_auth (
    key_id text DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    key text NOT NULL
);



--
-- Name: TABLE content_auth; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TABLE dionysus.content_auth IS 'Content authentication';


--
-- Name: content_tags; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.content_tags (
    content_tag_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: TABLE content_tags; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TABLE dionysus.content_tags IS 'Tags for content assets';


--
-- Name: countries; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.countries (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: genres; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.genres (
    id numeric NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: keywords; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.keywords (
    id numeric NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: languages; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.languages (
    id text NOT NULL,
    name text NOT NULL,
    native_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: media_asset; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_asset (
    asset_type text NOT NULL,
    media_id numeric NOT NULL,
    file_path text NOT NULL,
    asset_sha text NOT NULL,
    original_size numeric NOT NULL,
    new_size numeric NOT NULL,
    duration numeric NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: media_asset_download; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_asset_download (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    search_result_id text NOT NULL,
    status text NOT NULL,
    progress numeric NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nzb_id numeric,
    workflow_id uuid NOT NULL,
    asset_type text NOT NULL,
    media_id numeric NOT NULL
);



--
-- Name: media_asset_search_configuration; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_asset_search_configuration (
    asset_type text NOT NULL,
    media_id numeric NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    backoff numeric DEFAULT 24 NOT NULL,
    jitter numeric NOT NULL,
    last_execution_time timestamp with time zone,
    next_execution_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    season_number numeric,
    episode_number numeric,
    series_id numeric,
    status text DEFAULT 'ok'::text NOT NULL
);



--
-- Name: media_asset_search_execution; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_asset_search_execution (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    new_records numeric DEFAULT 0 NOT NULL,
    duplicate_records numeric DEFAULT 0 NOT NULL,
    skipped_records numeric DEFAULT 0 NOT NULL,
    total_records numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    search_type text NOT NULL,
    media_id numeric NOT NULL
);



--
-- Name: media_asset_search_result; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_asset_search_result (
    asset_type text NOT NULL,
    media_id numeric NOT NULL,
    title text NOT NULL,
    size numeric NOT NULL,
    password numeric NOT NULL,
    posted_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    quality text NOT NULL,
    quality_group text NOT NULL,
    source numeric DEFAULT '0'::numeric NOT NULL,
    modifier numeric DEFAULT '0'::numeric NOT NULL,
    resolution numeric DEFAULT '0'::numeric NOT NULL,
    repack boolean DEFAULT false NOT NULL,
    status text DEFAULT 'none'::text NOT NULL,
    score numeric DEFAULT '0'::numeric NOT NULL,
    id text NOT NULL
);



--
-- Name: media_asset_search_result_tag; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_asset_search_result_tag (
    search_result_id text NOT NULL,
    type text NOT NULL,
    value text NOT NULL,
    score numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: media_asset_workflow; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_asset_workflow (
    id uuid NOT NULL,
    asset_type text NOT NULL,
    media_id numeric NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone
);



--
-- Name: media_asset_workflow_step; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_asset_workflow_step (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    type text NOT NULL,
    status text NOT NULL,
    progress numeric DEFAULT 0 NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_step_id uuid,
    asset_type text NOT NULL,
    media_id numeric NOT NULL
);



--
-- Name: movies; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movies (
    id numeric NOT NULL,
    adult boolean DEFAULT false,
    backdrop_path text,
    budget numeric NOT NULL,
    homepage text,
    imdb_id text,
    original_language_id text NOT NULL,
    original_title text NOT NULL,
    overview text NOT NULL,
    poster_path text,
    release_date text,
    revenue numeric NOT NULL,
    runtime numeric NOT NULL,
    status text NOT NULL,
    tagline text NOT NULL,
    title text NOT NULL,
    video boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    popularity numeric DEFAULT '0'::numeric,
    vote_count numeric DEFAULT '0'::numeric,
    vote_average numeric DEFAULT '0'::numeric,
    media_type text DEFAULT 'movie'::text NOT NULL
);



--
-- Name: tv_episodes; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_episodes (
    id numeric NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    air_date text,
    episode_number numeric NOT NULL,
    name text NOT NULL,
    overview text NOT NULL,
    production_code text NOT NULL,
    runtime numeric DEFAULT '0'::numeric,
    season_number numeric NOT NULL,
    still_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vote_count numeric DEFAULT '0'::numeric,
    vote_average numeric DEFAULT '0'::numeric,
    media_type text DEFAULT 'tv_episode'::text NOT NULL
);



--
-- Name: tv_seasons; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_seasons (
    id numeric NOT NULL,
    air_date text,
    name text NOT NULL,
    overview text NOT NULL,
    poster_path text,
    season_number numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    series_id numeric,
    vote_average numeric DEFAULT '0'::numeric,
    media_type text DEFAULT 'tv_season'::text NOT NULL
);



--
-- Name: tv_series; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series (
    id numeric NOT NULL,
    adult boolean NOT NULL,
    backdrop_path text,
    first_air_date text,
    homepage text NOT NULL,
    in_production boolean NOT NULL,
    last_air_date text,
    last_episode_to_air numeric,
    name text NOT NULL,
    number_of_episodes numeric DEFAULT '0'::numeric NOT NULL,
    number_of_seasons numeric DEFAULT '0'::numeric NOT NULL,
    original_language text,
    original_name text NOT NULL,
    overview text NOT NULL,
    poster_path text,
    status text,
    tagline text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    popularity numeric DEFAULT '0'::numeric,
    vote_count numeric DEFAULT '0'::numeric,
    vote_average numeric DEFAULT '0'::numeric,
    next_episode_to_air numeric,
    media_type text DEFAULT 'tv_series'::text NOT NULL
);



--
-- Name: media_decorations; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.media_decorations AS
 SELECT movies.id,
    movies.media_type,
    movies.title AS name,
    NULL::text AS title,
    0 AS season,
    0 AS episode,
    movies.poster_path,
    0 AS series_id
   FROM dionysus.movies
UNION ALL
 SELECT a.id,
    a.media_type,
    a.name,
    b.name AS title,
    a.season_number AS season,
    0 AS episode,
    a.poster_path,
    a.series_id
   FROM dionysus.tv_seasons a,
    dionysus.tv_series b
  WHERE (a.series_id = b.id)
UNION ALL
 SELECT a.id,
    a.media_type,
    a.name,
    b.name AS title,
    a.season_number AS season,
    a.episode_number AS episode,
    b.poster_path,
    a.series_id
   FROM dionysus.tv_episodes a,
    dionysus.tv_series b
  WHERE (a.series_id = b.id)
UNION ALL
 SELECT tv_series.id,
    tv_series.media_type,
    tv_series.name,
    tv_series.name AS title,
    0 AS season,
    0 AS episode,
    tv_series.poster_path,
    tv_series.id AS series_id
   FROM dionysus.tv_series;



--
-- Name: media_favorite; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.media_favorite (
    type text NOT NULL,
    media_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: metadata_fetch_status; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.metadata_fetch_status (
    metadata_lock_id text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_fetched_at timestamp with time zone,
    status text NOT NULL,
    ttl numeric DEFAULT '30'::numeric,
    jitter numeric DEFAULT (floor(((random() * (4320)::double precision) + (1)::double precision)))::integer,
    context text
);



--
-- Name: metadata_fetch_status_expiration_statistics; Type: VIEW; Schema: dionysus; Owner: postgres
--

CREATE VIEW dionysus.metadata_fetch_status_expiration_statistics AS
 SELECT type,
    floor((((jitter * (60)::numeric) + (((ttl * (24)::numeric) * (60)::numeric) * (60)::numeric)) / ((((7 * 60) * 24) * 60))::numeric)) AS ttl_days,
    count(*) AS count
   FROM dionysus.metadata_fetch_status
  GROUP BY type, (floor((((jitter * (60)::numeric) + (((ttl * (24)::numeric) * (60)::numeric) * (60)::numeric)) / ((((7 * 60) * 24) * 60))::numeric)));



--
-- Name: metadata_fetch_status_statistics; Type: VIEW; Schema: dionysus; Owner: postgres
--

CREATE VIEW dionysus.metadata_fetch_status_statistics AS
 SELECT type,
    status,
    count(*) AS count
   FROM dionysus.metadata_fetch_status
  GROUP BY type, status;



--
-- Name: metadata_workflow; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.metadata_workflow (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    status text NOT NULL
);



--
-- Name: metadata_workflow_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.metadata_workflow_statistics AS
 SELECT to_char(created_at, 'yyyy-mm-dd'::text) AS created_date,
    ((sum(EXTRACT(epoch FROM (COALESCE(started_at, now()) - created_at))))::double precision / (count(*))::double precision) AS queue_time,
    ((sum(EXTRACT(epoch FROM (COALESCE(finished_at, now()) - started_at))))::double precision / (count(*))::double precision) AS run_time,
    count(*) AS count
   FROM dionysus.metadata_workflow
  WHERE (created_at > (now() - '30 days'::interval))
  GROUP BY (to_char(created_at, 'yyyy-mm-dd'::text));



--
-- Name: metadata_workflow_status_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.metadata_workflow_status_statistics AS
 SELECT to_char(created_at, 'yyyy-mm-dd'::text) AS created_date,
    status,
    count(*) AS count
   FROM dionysus.metadata_workflow
  WHERE (created_at > (now() - '30 days'::interval))
  GROUP BY (to_char(created_at, 'yyyy-mm-dd'::text)), status;



--
-- Name: metadata_workflow_step; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.metadata_workflow_step (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workflow_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text NOT NULL,
    attempt numeric NOT NULL,
    bulk_load_job_id uuid NOT NULL
);



--
-- Name: movie_alternative_titles; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_alternative_titles (
    movie_id numeric NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    iso_3166_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: movie_cast; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_cast (
    cast_id numeric NOT NULL,
    person_id numeric NOT NULL,
    original_name text NOT NULL,
    credit_id text NOT NULL,
    "order" numeric NOT NULL,
    "character" text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    movie_id numeric
);



--
-- Name: movie_crew; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_crew (
    credit_id text NOT NULL,
    person_id numeric NOT NULL,
    original_name text NOT NULL,
    department text NOT NULL,
    job text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    movie_id numeric
);



--
-- Name: movie_external_ids; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_external_ids (
    movie_id numeric NOT NULL,
    type text NOT NULL,
    external_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: movie_genres; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_genres (
    movie_id numeric NOT NULL,
    genre_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: movie_genre_count_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.movie_genre_count_statistics AS
 SELECT genre_count AS genres,
    count(1) AS count
   FROM ( SELECT movie_genres.movie_id,
            count(1) AS genre_count
           FROM dionysus.movie_genres
          GROUP BY movie_genres.movie_id) unnamed_subquery
  GROUP BY genre_count
  ORDER BY genre_count;



--
-- Name: movie_genre_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.movie_genre_statistics AS
 SELECT g.name AS genre,
    count(1) AS count
   FROM dionysus.genres g,
    dionysus.movie_genres mg
  WHERE (g.id = mg.genre_id)
  GROUP BY g.name
  ORDER BY g.name;



--
-- Name: movie_images; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_images (
    movie_id numeric NOT NULL,
    type text NOT NULL,
    file_path text NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    iso_639_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: movie_keywords; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_keywords (
    movie_id numeric NOT NULL,
    keyword_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: movie_production_countries; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_production_countries (
    movie_id numeric NOT NULL,
    country_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: movie_location_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.movie_location_statistics AS
 SELECT country_id,
    count(*) AS count
   FROM dionysus.movie_production_countries
  GROUP BY country_id;



--
-- Name: movie_production_companies; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_production_companies (
    movie_id numeric NOT NULL,
    production_company_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: movie_recommendations; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.movie_recommendations (
    id numeric NOT NULL,
    recommendation_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: movie_release_date_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.movie_release_date_statistics AS
 SELECT EXTRACT(year FROM (release_date)::date) AS year,
    count(*) AS count
   FROM dionysus.movies
  WHERE ((release_date IS NOT NULL) AND ((release_date)::date < now()) AND (EXTRACT(year FROM (release_date)::date) > (1900)::numeric))
  GROUP BY (EXTRACT(year FROM (release_date)::date));



--
-- Name: movie_release_dates; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_release_dates (
    movie_id numeric NOT NULL,
    iso_3166_1 text NOT NULL,
    release_date text NOT NULL,
    type numeric NOT NULL,
    note text,
    iso_639_1 text,
    certification_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    certification_type text DEFAULT 'Movie'::text NOT NULL
);



--
-- Name: movie_release_status_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.movie_release_status_statistics AS
 SELECT status,
    count(*) AS count
   FROM dionysus.movies
  GROUP BY status;



--
-- Name: movie_runtime_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.movie_runtime_statistics AS
 SELECT (round((runtime / (5)::numeric)) * (5)::numeric) AS rt,
    count(1) AS count
   FROM dionysus.movies
  WHERE ((runtime > (0)::numeric) AND (runtime < (240)::numeric))
  GROUP BY (round((runtime / (5)::numeric)) * (5)::numeric)
  ORDER BY (round((runtime / (5)::numeric)) * (5)::numeric);



--
-- Name: movie_spoken_languages; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_spoken_languages (
    movie_id numeric NOT NULL,
    language_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: movie_videos; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.movie_videos (
    id text NOT NULL,
    movie_id numeric NOT NULL,
    iso_639_1 text NOT NULL,
    iso_3166_1 text NOT NULL,
    name text NOT NULL,
    key text NOT NULL,
    site text NOT NULL,
    size numeric NOT NULL,
    type text NOT NULL,
    official boolean NOT NULL,
    published_at text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: network_alternative_names; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.network_alternative_names (
    id numeric NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: network_images; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.network_images (
    id text NOT NULL,
    file_path text NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    file_type text NOT NULL,
    network_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: networks; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.networks (
    id numeric NOT NULL,
    name text NOT NULL,
    headquarters text,
    homepage text,
    country_id text,
    logo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: people; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.people (
    id numeric NOT NULL,
    adult boolean DEFAULT false NOT NULL,
    biography text,
    birthday text,
    deathday text,
    gender numeric DEFAULT 0 NOT NULL,
    homepage text,
    imdb_id text,
    known_for_department text,
    name text NOT NULL,
    place_of_birth text,
    profile_path text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    popularity numeric DEFAULT '0'::numeric NOT NULL
);



--
-- Name: people_birthday_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.people_birthday_statistics AS
 SELECT EXTRACT(year FROM (birthday)::date) AS year,
    count(*) AS count
   FROM dionysus.people
  WHERE ((birthday IS NOT NULL) AND ((birthday)::date < now()) AND (EXTRACT(year FROM (birthday)::date) > (1900)::numeric))
  GROUP BY (EXTRACT(year FROM (birthday)::date));



--
-- Name: people_deathday_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.people_deathday_statistics AS
 SELECT EXTRACT(year FROM (deathday)::date) AS year,
    count(*) AS count
   FROM dionysus.people
  WHERE ((deathday IS NOT NULL) AND ((deathday)::date < now()) AND (EXTRACT(year FROM (deathday)::date) > (1900)::numeric))
  GROUP BY (EXTRACT(year FROM (deathday)::date));



--
-- Name: people_known_for; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.people_known_for AS
 SELECT known_for_department AS department,
    count(*) AS count
   FROM dionysus.people
  GROUP BY known_for_department
  ORDER BY known_for_department DESC;



--
-- Name: person_aka; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.person_aka (
    id numeric NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: person_external_ids; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.person_external_ids (
    id numeric NOT NULL,
    external_id_type text NOT NULL,
    external_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: person_images; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.person_images (
    id numeric NOT NULL,
    file_path text NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    iso_639_1 text,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);



--
-- Name: production_companies; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.production_companies (
    id numeric NOT NULL,
    name text NOT NULL,
    description text,
    headquarters text,
    homepage text,
    logo text,
    country_id text,
    parent_company numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: production_company_alternative_names; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.production_company_alternative_names (
    id numeric NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: production_company_logos; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.production_company_logos (
    id text NOT NULL,
    file_path text NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    file_type text NOT NULL,
    production_company_id numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: tv_episode_cast; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_episode_cast (
    credit_id text NOT NULL,
    person_id numeric NOT NULL,
    original_name text NOT NULL,
    "order" numeric NOT NULL,
    "character" text NOT NULL,
    episode_id numeric NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_episode_crew; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_episode_crew (
    credit_id text NOT NULL,
    person_id numeric NOT NULL,
    original_name text NOT NULL,
    department text NOT NULL,
    job text NOT NULL,
    episode_id numeric NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_episode_external_ids; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_episode_external_ids (
    episode_id numeric NOT NULL,
    type text NOT NULL,
    external_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL
);



--
-- Name: tv_episode_guest_stars; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_episode_guest_stars (
    credit_id text NOT NULL,
    person_id numeric NOT NULL,
    original_name text NOT NULL,
    "character" text NOT NULL,
    "order" numeric NOT NULL,
    episode_id numeric NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_episode_images; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_episode_images (
    episode_id numeric NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    file_path text NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text NOT NULL,
    iso_639_1 text
);



--
-- Name: tv_episode_videos; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_episode_videos (
    id text NOT NULL,
    episode_id numeric NOT NULL,
    type text NOT NULL,
    official boolean NOT NULL,
    published_at text NOT NULL,
    size numeric NOT NULL,
    site text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    iso_3166_1 text NOT NULL,
    iso_639_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    series_id numeric NOT NULL,
    season_id numeric NOT NULL
);



--
-- Name: tv_season_cast; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_season_cast (
    person_id numeric NOT NULL,
    "order" numeric NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_episode_count numeric DEFAULT '0'::numeric,
    original_name text
);



--
-- Name: tv_season_cast_roles; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.tv_season_cast_roles (
    series_id numeric NOT NULL,
    person_id numeric NOT NULL,
    season_id numeric NOT NULL,
    "character" text NOT NULL,
    episode_count numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    credit_id text NOT NULL
);



--
-- Name: tv_season_crew; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_season_crew (
    person_id numeric NOT NULL,
    original_name text NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_episode_count numeric DEFAULT '0'::numeric,
    department text NOT NULL
);



--
-- Name: tv_season_crew_jobs; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.tv_season_crew_jobs (
    series_id numeric NOT NULL,
    person_id numeric NOT NULL,
    season_id numeric NOT NULL,
    credit_id text NOT NULL,
    job text NOT NULL,
    episode_count numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_season_external_ids; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_season_external_ids (
    season_id numeric NOT NULL,
    type text NOT NULL,
    external_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_season_images; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_season_images (
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    file_path text NOT NULL,
    type text NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    iso_639_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_season_videos; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_season_videos (
    id text NOT NULL,
    season_id numeric NOT NULL,
    series_id numeric NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    official boolean NOT NULL,
    published_at text NOT NULL,
    size numeric NOT NULL,
    key text NOT NULL,
    iso_3166_1 text NOT NULL,
    iso_639_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    site text
);



--
-- Name: tv_series_alternative_titles; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_alternative_titles (
    series_id numeric NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    iso_3166_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_cast; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_cast (
    person_id numeric NOT NULL,
    "order" numeric NOT NULL,
    series_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_episode_count numeric DEFAULT '0'::numeric NOT NULL,
    original_name text
);



--
-- Name: tv_series_cast_roles; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.tv_series_cast_roles (
    series_id numeric NOT NULL,
    person_id numeric NOT NULL,
    "character" text NOT NULL,
    episode_count numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    credit_id text NOT NULL
);



--
-- Name: tv_series_content_ratings; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_content_ratings (
    series_id numeric NOT NULL,
    iso_3166_1 text NOT NULL,
    rating text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    certification_type text DEFAULT 'TV'::text NOT NULL
);



--
-- Name: tv_series_created_by; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_created_by (
    credit_id text NOT NULL,
    series_id numeric NOT NULL,
    person_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_crew; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_crew (
    person_id numeric NOT NULL,
    series_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    department text NOT NULL,
    total_episode_count numeric DEFAULT '0'::numeric NOT NULL,
    original_name text
);



--
-- Name: tv_series_crew_jobs; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.tv_series_crew_jobs (
    series_id numeric NOT NULL,
    person_id numeric NOT NULL,
    credit_id text NOT NULL,
    job text NOT NULL,
    episode_count numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_episode_run_times; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_episode_run_times (
    series_id numeric NOT NULL,
    run_time numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_episode_runtime_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.tv_series_episode_runtime_statistics AS
 SELECT (round((run_time / (5)::numeric)) * (5)::numeric) AS rt,
    count(1) AS count
   FROM dionysus.tv_series_episode_run_times
  WHERE ((run_time > (0)::numeric) AND (run_time < (240)::numeric))
  GROUP BY (round((run_time / (5)::numeric)) * (5)::numeric)
  ORDER BY (round((run_time / (5)::numeric)) * (5)::numeric);



--
-- Name: tv_series_external_ids; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_external_ids (
    series_id numeric NOT NULL,
    type text NOT NULL,
    external_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_first_air_date_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.tv_series_first_air_date_statistics AS
 SELECT EXTRACT(year FROM (first_air_date)::date) AS year,
    count(*) AS count
   FROM dionysus.tv_series
  WHERE ((first_air_date IS NOT NULL) AND ((first_air_date)::date < now()) AND (EXTRACT(year FROM (first_air_date)::date) > (1900)::numeric))
  GROUP BY (EXTRACT(year FROM (first_air_date)::date));



--
-- Name: tv_series_genres; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_genres (
    series_id numeric NOT NULL,
    genre_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_genre_count_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.tv_series_genre_count_statistics AS
 SELECT genre_count AS genres,
    count(1) AS count
   FROM ( SELECT tv_series_genres.series_id,
            count(1) AS genre_count
           FROM dionysus.tv_series_genres
          GROUP BY tv_series_genres.series_id) unnamed_subquery
  GROUP BY genre_count
  ORDER BY genre_count;



--
-- Name: tv_series_genre_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.tv_series_genre_statistics AS
 SELECT g.name AS genre,
    count(1) AS count
   FROM dionysus.genres g,
    dionysus.tv_series_genres tsg
  WHERE (g.id = tsg.genre_id)
  GROUP BY g.name
  ORDER BY g.name;



--
-- Name: tv_series_images; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_images (
    series_id numeric NOT NULL,
    file_path text NOT NULL,
    type text NOT NULL,
    width numeric NOT NULL,
    height numeric NOT NULL,
    iso_639_1 text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_keywords; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_keywords (
    series_id numeric NOT NULL,
    keyword_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_languages; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_languages (
    series_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    language_id text NOT NULL
);



--
-- Name: tv_series_production_countries; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_production_countries (
    series_id numeric NOT NULL,
    country_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_location_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.tv_series_location_statistics AS
 SELECT country_id,
    count(*) AS count
   FROM dionysus.tv_series_production_countries
  GROUP BY country_id;



--
-- Name: tv_series_networks; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_networks (
    series_id numeric NOT NULL,
    network_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_origin_countries; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_origin_countries (
    series_id numeric NOT NULL,
    country_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_production_companies; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_production_companies (
    series_id numeric NOT NULL,
    production_company_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_recommendations; Type: TABLE; Schema: dionysus; Owner: olympus
--

CREATE TABLE dionysus.tv_series_recommendations (
    id numeric NOT NULL,
    recommendation_id numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_season_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.tv_series_season_statistics AS
 SELECT number_of_seasons AS seasons,
    count(*) AS count
   FROM dionysus.tv_series
  WHERE (number_of_seasons < (50)::numeric)
  GROUP BY number_of_seasons;



--
-- Name: tv_series_spoken_languages; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_spoken_languages (
    series_id numeric NOT NULL,
    language_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: tv_series_status_statistics; Type: VIEW; Schema: dionysus; Owner: olympus
--

CREATE VIEW dionysus.tv_series_status_statistics AS
 SELECT status,
    count(*) AS count
   FROM dionysus.tv_series
  GROUP BY status;



--
-- Name: tv_series_videos; Type: TABLE; Schema: dionysus; Owner: postgres
--

CREATE TABLE dionysus.tv_series_videos (
    id text NOT NULL,
    series_id numeric NOT NULL,
    type text NOT NULL,
    name text NOT NULL,
    official boolean NOT NULL,
    published_at text NOT NULL,
    size numeric NOT NULL,
    key text NOT NULL,
    iso_3166_1 text NOT NULL,
    iso_639_1 text NOT NULL,
    site text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: meeting_attendees; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.meeting_attendees (
    meeting_id text NOT NULL,
    attendee_email text NOT NULL,
    attendance text NOT NULL,
    response text NOT NULL
);



--
-- Name: meeting_notes; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.meeting_notes (
    meeting_id text NOT NULL,
    note_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: meeting_user; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.meeting_user (
    email text NOT NULL,
    alias text,
    given_name text NOT NULL,
    surname text,
    type text NOT NULL
);



--
-- Name: meetings; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.meetings (
    id text NOT NULL,
    subject text,
    sensitivity text NOT NULL,
    importance text,
    occurrence_type text NOT NULL,
    type text NOT NULL,
    reminder boolean NOT NULL,
    response text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    duration numeric NOT NULL,
    all_day boolean NOT NULL,
    status text,
    location text,
    cancelled boolean NOT NULL,
    organizer_email text,
    deleted boolean DEFAULT false,
    uid text,
    recurrence_id text,
    source text DEFAULT 'AMZN'::text NOT NULL
);



--
-- Name: note_associations; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.note_associations (
    note_id uuid NOT NULL,
    item_id text NOT NULL,
    item_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);



--
-- Name: notes; Type: TABLE; Schema: minerva; Owner: postgres
--

CREATE TABLE minerva.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author text NOT NULL,
    flagged boolean DEFAULT false NOT NULL,
    type numeric NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    title text,
    summary text,
    parent_id uuid
);



--
-- Name: notification_groups; Type: TABLE; Schema: olympus; Owner: olympus
--

CREATE TABLE olympus.notification_groups (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text
);



--
-- Name: notification_settings; Type: TABLE; Schema: olympus; Owner: olympus
--

CREATE TABLE olympus.notification_settings (
    username text NOT NULL,
    notification_type_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    websocket_enabled boolean DEFAULT false,
    synochat_enabled boolean DEFAULT false,
    synomail_enabled boolean DEFAULT false,
    email_enabled boolean DEFAULT false
);



--
-- Name: notifications; Type: TABLE; Schema: olympus; Owner: olympus
--

CREATE TABLE olympus.notifications (
    "eventId" uuid NOT NULL,
    notification_id uuid NOT NULL,
    event_time timestamp with time zone DEFAULT now() NOT NULL,
    notification_type_id text NOT NULL,
    level text NOT NULL,
    acknowledged boolean DEFAULT false NOT NULL,
    "group" text,
    expires_at timestamp with time zone,
    delete_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    payload text,
    acknowledged_at timestamp with time zone,
    ttl text
);



--
-- Name: notification_statistics; Type: VIEW; Schema: olympus; Owner: olympus
--

CREATE VIEW olympus.notification_statistics AS
 SELECT "group",
    level,
    acknowledged,
    count(*) AS count
   FROM olympus.notifications
  WHERE ((expires_at IS NULL) OR (expires_at > now()))
  GROUP BY "group", level, acknowledged;



--
-- Name: notification_type; Type: TABLE; Schema: olympus; Owner: olympus
--

CREATE TABLE olympus.notification_type (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    default_group_id text,
    websocket_supported boolean DEFAULT false NOT NULL,
    synochat_supported boolean DEFAULT false NOT NULL,
    synomail_supported boolean DEFAULT false NOT NULL,
    email_supported boolean DEFAULT false NOT NULL,
    websocket_default_enabled boolean DEFAULT false NOT NULL,
    synochat_default_enabled boolean DEFAULT false,
    synomail_default_enabled boolean DEFAULT false,
    email_default_enabled boolean DEFAULT false
);



--
-- Name: media_asset_search_configuration asset_search_configuration_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_asset_search_configuration
    ADD CONSTRAINT asset_search_configuration_pkey PRIMARY KEY (asset_type, media_id);


--
-- Name: bulk_load_jobs bulk_load_jobs_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.bulk_load_jobs
    ADD CONSTRAINT bulk_load_jobs_pkey PRIMARY KEY (job_id);


--
-- Name: certifications certifications_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.certifications
    ADD CONSTRAINT certifications_pkey PRIMARY KEY (country, certification, type);


--
-- Name: collection_images collection_images_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.collection_images
    ADD CONSTRAINT collection_images_pkey PRIMARY KEY (collection_id, type, file_path, iso_639_1);


--
-- Name: collection_parts collection_parts_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.collection_parts
    ADD CONSTRAINT collection_parts_pkey PRIMARY KEY (collection_id, movie_id);


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.collections
    ADD CONSTRAINT collections_pkey PRIMARY KEY (id);


--
-- Name: content_asset_channel_cache content_asset_channel_cache_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.content_asset_channel_cache
    ADD CONSTRAINT content_asset_channel_cache_pkey PRIMARY KEY (channel_id, asset_id);


--
-- Name: content_asset_channel_category content_asset_channel_category_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.content_asset_channel_category
    ADD CONSTRAINT content_asset_channel_category_pkey PRIMARY KEY (id);


--
-- Name: content_asset_channel content_asset_channel_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.content_asset_channel
    ADD CONSTRAINT content_asset_channel_pkey PRIMARY KEY (id);


--
-- Name: content_asset_ingest_workflow_steps content_asset_ingest_workflow_steps_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.content_asset_ingest_workflow_steps
    ADD CONSTRAINT content_asset_ingest_workflow_steps_pkey PRIMARY KEY (id, workflow_id);


--
-- Name: content_asset_ingest_workflows content_asset_ingest_workflows_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.content_asset_ingest_workflows
    ADD CONSTRAINT content_asset_ingest_workflows_pkey PRIMARY KEY (id);


--
-- Name: content_asset_jobs content_asset_jobs_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.content_asset_jobs
    ADD CONSTRAINT content_asset_jobs_pkey PRIMARY KEY (content_id);


--
-- Name: content_asset_tags content_asset_tags_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.content_asset_tags
    ADD CONSTRAINT content_asset_tags_pkey PRIMARY KEY (content_id, content_tag_id);


--
-- Name: content_assets content_assets_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.content_assets
    ADD CONSTRAINT content_assets_pkey PRIMARY KEY (content_id);


--
-- Name: content_auth content_auth_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.content_auth
    ADD CONSTRAINT content_auth_pkey PRIMARY KEY (key_id);


--
-- Name: content_tags content_tags_name_type_key; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.content_tags
    ADD CONSTRAINT content_tags_name_type_key UNIQUE (name, type);


--
-- Name: content_tags content_tags_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.content_tags
    ADD CONSTRAINT content_tags_pkey PRIMARY KEY (content_tag_id);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: genres genres_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.genres
    ADD CONSTRAINT genres_pkey PRIMARY KEY (id, type);


--
-- Name: keywords keywords_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.keywords
    ADD CONSTRAINT keywords_pkey PRIMARY KEY (id);


--
-- Name: languages languages_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.languages
    ADD CONSTRAINT languages_pkey PRIMARY KEY (id);


--
-- Name: media_asset_download media_asset_download_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_asset_download
    ADD CONSTRAINT media_asset_download_pkey PRIMARY KEY (id, search_result_id);


--
-- Name: media_asset media_asset_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_asset
    ADD CONSTRAINT media_asset_pkey PRIMARY KEY (asset_type, media_id);


--
-- Name: media_asset_search_execution media_asset_search_execution_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_asset_search_execution
    ADD CONSTRAINT media_asset_search_execution_pkey PRIMARY KEY (id);


--
-- Name: media_asset_search_result media_asset_search_result_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_asset_search_result
    ADD CONSTRAINT media_asset_search_result_pkey PRIMARY KEY (asset_type, media_id, id);


--
-- Name: media_asset_search_result_tag media_asset_search_result_tag_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_asset_search_result_tag
    ADD CONSTRAINT media_asset_search_result_tag_pkey PRIMARY KEY (search_result_id, type, value);


--
-- Name: media_asset_workflow media_asset_workflow_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_asset_workflow
    ADD CONSTRAINT media_asset_workflow_pkey PRIMARY KEY (id);


--
-- Name: media_asset_workflow_step media_asset_workflow_step_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_asset_workflow_step
    ADD CONSTRAINT media_asset_workflow_step_pkey PRIMARY KEY (id, workflow_id);


--
-- Name: media_favorite media_favorite_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.media_favorite
    ADD CONSTRAINT media_favorite_pkey PRIMARY KEY (type, media_id);


--
-- Name: metadata_fetch_status metadata_locks_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.metadata_fetch_status
    ADD CONSTRAINT metadata_locks_pkey PRIMARY KEY (metadata_lock_id, type);


--
-- Name: metadata_workflow metadata_workflow_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.metadata_workflow
    ADD CONSTRAINT metadata_workflow_pkey PRIMARY KEY (id);


--
-- Name: metadata_workflow_step metadata_workflow_step_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.metadata_workflow_step
    ADD CONSTRAINT metadata_workflow_step_pkey PRIMARY KEY (id, workflow_id);


--
-- Name: movie_alternative_titles movie_alternative_titles_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_alternative_titles
    ADD CONSTRAINT movie_alternative_titles_pkey PRIMARY KEY (title, movie_id, type, iso_3166_1);


--
-- Name: movie_cast movie_cast_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_cast
    ADD CONSTRAINT movie_cast_pkey PRIMARY KEY (credit_id);


--
-- Name: movie_crew movie_crew_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_crew
    ADD CONSTRAINT movie_crew_pkey PRIMARY KEY (credit_id);


--
-- Name: movie_external_ids movie_external_ids_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_external_ids
    ADD CONSTRAINT movie_external_ids_pkey PRIMARY KEY (movie_id, type);


--
-- Name: movie_genres movie_genres_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_genres
    ADD CONSTRAINT movie_genres_pkey PRIMARY KEY (movie_id, genre_id);


--
-- Name: movie_images movie_images_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_images
    ADD CONSTRAINT movie_images_pkey PRIMARY KEY (type, movie_id, file_path, iso_639_1);


--
-- Name: movie_keywords movie_keywords_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_keywords
    ADD CONSTRAINT movie_keywords_pkey PRIMARY KEY (movie_id, keyword_id);


--
-- Name: movie_production_companies movie_production_companies_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_production_companies
    ADD CONSTRAINT movie_production_companies_pkey PRIMARY KEY (movie_id, production_company_id);


--
-- Name: movie_production_countries movie_production_countries_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_production_countries
    ADD CONSTRAINT movie_production_countries_pkey PRIMARY KEY (movie_id, country_id);


--
-- Name: movie_recommendations movie_recommendations_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.movie_recommendations
    ADD CONSTRAINT movie_recommendations_pkey PRIMARY KEY (id, recommendation_id);


--
-- Name: movie_release_dates movie_release_dates_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_release_dates
    ADD CONSTRAINT movie_release_dates_pkey PRIMARY KEY (iso_3166_1, movie_id, release_date, type);


--
-- Name: movie_spoken_languages movie_spoken_languages_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_spoken_languages
    ADD CONSTRAINT movie_spoken_languages_pkey PRIMARY KEY (movie_id, language_id);


--
-- Name: movie_videos movie_videos_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movie_videos
    ADD CONSTRAINT movie_videos_pkey PRIMARY KEY (id);


--
-- Name: movies movies_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.movies
    ADD CONSTRAINT movies_pkey PRIMARY KEY (id);


--
-- Name: network_alternative_names network_alternative_name_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.network_alternative_names
    ADD CONSTRAINT network_alternative_name_pkey PRIMARY KEY (id, name);


--
-- Name: network_images network_images_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.network_images
    ADD CONSTRAINT network_images_pkey PRIMARY KEY (id);


--
-- Name: networks networks_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.networks
    ADD CONSTRAINT networks_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: person_aka person_aka_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.person_aka
    ADD CONSTRAINT person_aka_pkey PRIMARY KEY (id, name);


--
-- Name: person_external_ids person_external_ids_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.person_external_ids
    ADD CONSTRAINT person_external_ids_pkey PRIMARY KEY (id, external_id, external_id_type);


--
-- Name: person_images person_images_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.person_images
    ADD CONSTRAINT person_images_pkey PRIMARY KEY (id, file_path);


--
-- Name: production_company_alternative_names production_companies_alternative_names_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.production_company_alternative_names
    ADD CONSTRAINT production_companies_alternative_names_pkey PRIMARY KEY (id, name, type);


--
-- Name: production_companies production_companies_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.production_companies
    ADD CONSTRAINT production_companies_pkey PRIMARY KEY (id);


--
-- Name: production_company_logos production_company_logos_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.production_company_logos
    ADD CONSTRAINT production_company_logos_pkey PRIMARY KEY (id);


--
-- Name: tv_episode_cast tv_episode_cast_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_episode_cast
    ADD CONSTRAINT tv_episode_cast_pkey PRIMARY KEY (credit_id, person_id, season_id, episode_id, series_id);


--
-- Name: tv_episode_crew tv_episode_crew_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_episode_crew
    ADD CONSTRAINT tv_episode_crew_pkey PRIMARY KEY (credit_id, person_id, episode_id, season_id, series_id);


--
-- Name: tv_episode_external_ids tv_episode_external_ids_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_episode_external_ids
    ADD CONSTRAINT tv_episode_external_ids_pkey PRIMARY KEY (episode_id, external_id, season_id, series_id, type);


--
-- Name: tv_episode_guest_stars tv_episode_guest_stars_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_episode_guest_stars
    ADD CONSTRAINT tv_episode_guest_stars_pkey PRIMARY KEY (credit_id, person_id, episode_id, season_id, series_id);


--
-- Name: tv_episode_images tv_episode_images_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_episode_images
    ADD CONSTRAINT tv_episode_images_pkey PRIMARY KEY (episode_id, file_path, type);


--
-- Name: tv_episode_videos tv_episode_videos_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_episode_videos
    ADD CONSTRAINT tv_episode_videos_pkey PRIMARY KEY (id);


--
-- Name: tv_episodes tv_episodes_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_episodes
    ADD CONSTRAINT tv_episodes_pkey PRIMARY KEY (id);


--
-- Name: tv_season_cast tv_season_cast_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_season_cast
    ADD CONSTRAINT tv_season_cast_pkey PRIMARY KEY (person_id, series_id, season_id);


--
-- Name: tv_season_cast_roles tv_season_cast_roles_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.tv_season_cast_roles
    ADD CONSTRAINT tv_season_cast_roles_pkey PRIMARY KEY (person_id, series_id, season_id, credit_id);


--
-- Name: tv_season_crew_jobs tv_season_crew_jobs_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.tv_season_crew_jobs
    ADD CONSTRAINT tv_season_crew_jobs_pkey PRIMARY KEY (person_id, series_id, season_id, credit_id);


--
-- Name: tv_season_crew tv_season_crew_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_season_crew
    ADD CONSTRAINT tv_season_crew_pkey PRIMARY KEY (season_id, person_id, series_id, department);


--
-- Name: tv_season_external_ids tv_season_external_ids_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_season_external_ids
    ADD CONSTRAINT tv_season_external_ids_pkey PRIMARY KEY (season_id, type);


--
-- Name: tv_season_images tv_season_images_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_season_images
    ADD CONSTRAINT tv_season_images_pkey PRIMARY KEY (type, season_id, file_path, iso_639_1);


--
-- Name: tv_season_videos tv_season_videos_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_season_videos
    ADD CONSTRAINT tv_season_videos_pkey PRIMARY KEY (id);


--
-- Name: tv_seasons tv_seasons_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_seasons
    ADD CONSTRAINT tv_seasons_pkey PRIMARY KEY (id);


--
-- Name: tv_series_alternative_titles tv_series_alternative_titles_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_alternative_titles
    ADD CONSTRAINT tv_series_alternative_titles_pkey PRIMARY KEY (series_id, type, iso_3166_1, title);


--
-- Name: tv_series_cast tv_series_cast_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_cast
    ADD CONSTRAINT tv_series_cast_pkey PRIMARY KEY (series_id, person_id);


--
-- Name: tv_series_cast_roles tv_series_cast_roles_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.tv_series_cast_roles
    ADD CONSTRAINT tv_series_cast_roles_pkey PRIMARY KEY (series_id, person_id, credit_id);


--
-- Name: tv_series_content_ratings tv_series_content_ratings_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_content_ratings
    ADD CONSTRAINT tv_series_content_ratings_pkey PRIMARY KEY (series_id, iso_3166_1, rating);


--
-- Name: tv_series_created_by tv_series_created_by_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_created_by
    ADD CONSTRAINT tv_series_created_by_pkey PRIMARY KEY (credit_id, series_id, person_id);


--
-- Name: tv_series_crew_jobs tv_series_crew_jobs_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.tv_series_crew_jobs
    ADD CONSTRAINT tv_series_crew_jobs_pkey PRIMARY KEY (series_id, person_id, credit_id);


--
-- Name: tv_series_crew tv_series_crew_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_crew
    ADD CONSTRAINT tv_series_crew_pkey PRIMARY KEY (series_id, person_id, department);


--
-- Name: tv_series_episode_run_times tv_series_episode_run_times_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_episode_run_times
    ADD CONSTRAINT tv_series_episode_run_times_pkey PRIMARY KEY (series_id, run_time);


--
-- Name: tv_series_external_ids tv_series_external_ids_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_external_ids
    ADD CONSTRAINT tv_series_external_ids_pkey PRIMARY KEY (series_id, type);


--
-- Name: tv_series_genres tv_series_genres_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_genres
    ADD CONSTRAINT tv_series_genres_pkey PRIMARY KEY (series_id, genre_id);


--
-- Name: tv_series_images tv_series_images_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_images
    ADD CONSTRAINT tv_series_images_pkey PRIMARY KEY (file_path, type, series_id, iso_639_1);


--
-- Name: tv_series_keywords tv_series_keywords_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_keywords
    ADD CONSTRAINT tv_series_keywords_pkey PRIMARY KEY (series_id, keyword_id);


--
-- Name: tv_series_languages tv_series_languages_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_languages
    ADD CONSTRAINT tv_series_languages_pkey PRIMARY KEY (series_id, language_id);


--
-- Name: tv_series_networks tv_series_networks_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_networks
    ADD CONSTRAINT tv_series_networks_pkey PRIMARY KEY (series_id, network_id);


--
-- Name: tv_series_origin_countries tv_series_origin_countries_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_origin_countries
    ADD CONSTRAINT tv_series_origin_countries_pkey PRIMARY KEY (series_id, country_id);


--
-- Name: tv_series tv_series_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series
    ADD CONSTRAINT tv_series_pkey PRIMARY KEY (id);


--
-- Name: tv_series_production_companies tv_series_production_companies_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_production_companies
    ADD CONSTRAINT tv_series_production_companies_pkey PRIMARY KEY (series_id, production_company_id);


--
-- Name: tv_series_production_countries tv_series_production_countries_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_production_countries
    ADD CONSTRAINT tv_series_production_countries_pkey PRIMARY KEY (series_id, country_id);


--
-- Name: tv_series_recommendations tv_series_recommendations_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: olympus
--

ALTER TABLE ONLY dionysus.tv_series_recommendations
    ADD CONSTRAINT tv_series_recommendations_pkey PRIMARY KEY (id, recommendation_id);


--
-- Name: tv_series_spoken_languages tv_series_spoken_languages_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_spoken_languages
    ADD CONSTRAINT tv_series_spoken_languages_pkey PRIMARY KEY (series_id, language_id);


--
-- Name: tv_series_videos tv_series_videos_pkey; Type: CONSTRAINT; Schema: dionysus; Owner: postgres
--

ALTER TABLE ONLY dionysus.tv_series_videos
    ADD CONSTRAINT tv_series_videos_pkey PRIMARY KEY (id);


--
-- Name: meeting_attendees meeting_attendees_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.meeting_attendees
    ADD CONSTRAINT meeting_attendees_pkey PRIMARY KEY (meeting_id, attendee_email);


--
-- Name: meeting_day_statistics_type meeting_day_statistics_type_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.meeting_day_statistics_type
    ADD CONSTRAINT meeting_day_statistics_type_pkey PRIMARY KEY (day);


--
-- Name: meeting_hour_statistics_type meeting_hour_statistics_type_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.meeting_hour_statistics_type
    ADD CONSTRAINT meeting_hour_statistics_type_pkey PRIMARY KEY (hour);


--
-- Name: meeting_notes meeting_notes_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.meeting_notes
    ADD CONSTRAINT meeting_notes_pkey PRIMARY KEY (meeting_id, note_id);


--
-- Name: meeting_status_statistics_type meeting_status_statistics_type_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.meeting_status_statistics_type
    ADD CONSTRAINT meeting_status_statistics_type_pkey PRIMARY KEY (start_date, status);


--
-- Name: meeting_user meeting_user_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.meeting_user
    ADD CONSTRAINT meeting_user_pkey PRIMARY KEY (email);


--
-- Name: meetings meetings_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.meetings
    ADD CONSTRAINT meetings_pkey PRIMARY KEY (id);


--
-- Name: note_associations note_associations_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.note_associations
    ADD CONSTRAINT note_associations_pkey PRIMARY KEY (note_id, item_id, item_type);


--
-- Name: notes_hour_statistics_type notes_hour_stats_type_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.notes_hour_statistics_type
    ADD CONSTRAINT notes_hour_stats_type_pkey PRIMARY KEY (created, hour);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: notes_type_statistics_type notes_type_statistics_type_pkey; Type: CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.notes_type_statistics_type
    ADD CONSTRAINT notes_type_statistics_type_pkey PRIMARY KEY (created, type);


--
-- Name: notification_groups notification_group_name_key; Type: CONSTRAINT; Schema: olympus; Owner: olympus
--

ALTER TABLE ONLY olympus.notification_groups
    ADD CONSTRAINT notification_group_name_key UNIQUE (name);


--
-- Name: notification_groups notification_group_pkey; Type: CONSTRAINT; Schema: olympus; Owner: olympus
--

ALTER TABLE ONLY olympus.notification_groups
    ADD CONSTRAINT notification_group_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: olympus; Owner: olympus
--

ALTER TABLE ONLY olympus.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (notification_type_id, username);


--
-- Name: notification_type notification_type_pkey; Type: CONSTRAINT; Schema: olympus; Owner: olympus
--

ALTER TABLE ONLY olympus.notification_type
    ADD CONSTRAINT notification_type_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: olympus; Owner: olympus
--

ALTER TABLE ONLY olympus.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY ("eventId");


--
-- Name: movie_alt_titles_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_alt_titles_movie_id_idx ON dionysus.movie_alternative_titles USING btree (movie_id);


--
-- Name: movie_cast_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_cast_movie_id_idx ON dionysus.movie_cast USING btree (movie_id);


--
-- Name: movie_cast_person_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_cast_person_id_idx ON dionysus.movie_cast USING btree (person_id);


--
-- Name: movie_crew_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_crew_movie_id_idx ON dionysus.movie_crew USING btree (movie_id);


--
-- Name: movie_crew_person_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_crew_person_id_idx ON dionysus.movie_crew USING btree (person_id);


--
-- Name: movie_external_id_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_external_id_movie_id_idx ON dionysus.movie_external_ids USING btree (movie_id);


--
-- Name: movie_genres_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_genres_movie_id_idx ON dionysus.movie_genres USING btree (movie_id);


--
-- Name: movie_indexes_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_indexes_movie_id_idx ON dionysus.movie_images USING btree (movie_id);


--
-- Name: movie_keywords_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_keywords_movie_id_idx ON dionysus.movie_keywords USING btree (movie_id);


--
-- Name: movie_production_company_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_production_company_movie_id_idx ON dionysus.movie_production_companies USING btree (movie_id);


--
-- Name: movie_production_country_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_production_country_movie_id_idx ON dionysus.movie_production_countries USING btree (movie_id);


--
-- Name: movie_release_dates_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_release_dates_movie_id_idx ON dionysus.movie_release_dates USING btree (movie_id);


--
-- Name: movie_spoken_languages_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_spoken_languages_movie_id_idx ON dionysus.movie_spoken_languages USING btree (movie_id);


--
-- Name: movie_videos_movie_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movie_videos_movie_id_idx ON dionysus.movie_videos USING btree (movie_id);


--
-- Name: movies_popularity_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX movies_popularity_idx ON dionysus.movies USING btree (popularity);


--
-- Name: test; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX test ON dionysus.metadata_fetch_status USING btree (type, status, ttl);


--
-- Name: tv_episode_episode_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX tv_episode_episode_id_idx ON dionysus.tv_episode_cast USING btree (episode_id);


--
-- Name: tv_episode_guest_stars_by_episode_id_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX tv_episode_guest_stars_by_episode_id_idx ON dionysus.tv_episode_guest_stars USING btree (episode_id);


--
-- Name: tv_episodes_by_series_ids_idx; Type: INDEX; Schema: dionysus; Owner: postgres
--

CREATE INDEX tv_episodes_by_series_ids_idx ON dionysus.tv_episodes USING btree (series_id, season_id, episode_number);


--
-- Name: media_asset_search_configuration set_dionysus_asset_search_configuration_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_asset_search_configuration_updated_at BEFORE UPDATE ON dionysus.media_asset_search_configuration FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_asset_search_configuration_updated_at ON media_asset_search_configuration; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_asset_search_configuration_updated_at ON dionysus.media_asset_search_configuration IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: bulk_load_jobs set_dionysus_bulk_load_jobs_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_bulk_load_jobs_updated_at BEFORE UPDATE ON dionysus.bulk_load_jobs FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_bulk_load_jobs_updated_at ON bulk_load_jobs; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_bulk_load_jobs_updated_at ON dionysus.bulk_load_jobs IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: certifications set_dionysus_certifications_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_certifications_updated_at BEFORE UPDATE ON dionysus.certifications FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_certifications_updated_at ON certifications; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_certifications_updated_at ON dionysus.certifications IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: collection_images set_dionysus_collection_images_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_collection_images_updated_at BEFORE UPDATE ON dionysus.collection_images FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_collection_images_updated_at ON collection_images; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_collection_images_updated_at ON dionysus.collection_images IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: collection_parts set_dionysus_collection_parts_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_collection_parts_updated_at BEFORE UPDATE ON dionysus.collection_parts FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_collection_parts_updated_at ON collection_parts; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_collection_parts_updated_at ON dionysus.collection_parts IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: collections set_dionysus_collections_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_collections_updated_at BEFORE UPDATE ON dionysus.collections FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_collections_updated_at ON collections; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_collections_updated_at ON dionysus.collections IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: content_asset_channel_cache set_dionysus_content_asset_channel_cache_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_content_asset_channel_cache_updated_at BEFORE UPDATE ON dionysus.content_asset_channel_cache FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_content_asset_channel_cache_updated_at ON content_asset_channel_cache; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_content_asset_channel_cache_updated_at ON dionysus.content_asset_channel_cache IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: content_asset_channel_category set_dionysus_content_asset_channel_category_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_content_asset_channel_category_updated_at BEFORE UPDATE ON dionysus.content_asset_channel_category FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_content_asset_channel_category_updated_at ON content_asset_channel_category; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_content_asset_channel_category_updated_at ON dionysus.content_asset_channel_category IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: content_asset_channel set_dionysus_content_asset_channel_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_content_asset_channel_updated_at BEFORE UPDATE ON dionysus.content_asset_channel FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_content_asset_channel_updated_at ON content_asset_channel; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_content_asset_channel_updated_at ON dionysus.content_asset_channel IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: content_asset_ingest_workflow_steps set_dionysus_content_asset_ingest_workflow_steps_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_content_asset_ingest_workflow_steps_updated_at BEFORE UPDATE ON dionysus.content_asset_ingest_workflow_steps FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_content_asset_ingest_workflow_steps_updated_at ON content_asset_ingest_workflow_steps; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_content_asset_ingest_workflow_steps_updated_at ON dionysus.content_asset_ingest_workflow_steps IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: content_asset_ingest_workflows set_dionysus_content_asset_ingest_workflows_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_content_asset_ingest_workflows_updated_at BEFORE UPDATE ON dionysus.content_asset_ingest_workflows FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_content_asset_ingest_workflows_updated_at ON content_asset_ingest_workflows; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_content_asset_ingest_workflows_updated_at ON dionysus.content_asset_ingest_workflows IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: content_asset_jobs set_dionysus_content_asset_jobs_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_content_asset_jobs_updated_at BEFORE UPDATE ON dionysus.content_asset_jobs FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_content_asset_jobs_updated_at ON content_asset_jobs; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_content_asset_jobs_updated_at ON dionysus.content_asset_jobs IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: countries set_dionysus_countries_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_countries_updated_at BEFORE UPDATE ON dionysus.countries FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_countries_updated_at ON countries; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_countries_updated_at ON dionysus.countries IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: genres set_dionysus_genres_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_genres_updated_at BEFORE UPDATE ON dionysus.genres FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_genres_updated_at ON genres; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_genres_updated_at ON dionysus.genres IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: keywords set_dionysus_keywords_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_keywords_updated_at BEFORE UPDATE ON dionysus.keywords FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_keywords_updated_at ON keywords; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_keywords_updated_at ON dionysus.keywords IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: languages set_dionysus_languages_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_languages_updated_at BEFORE UPDATE ON dionysus.languages FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_languages_updated_at ON languages; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_languages_updated_at ON dionysus.languages IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: media_asset_download set_dionysus_media_asset_download_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_media_asset_download_updated_at BEFORE UPDATE ON dionysus.media_asset_download FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_media_asset_download_updated_at ON media_asset_download; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_media_asset_download_updated_at ON dionysus.media_asset_download IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: media_asset_search_execution set_dionysus_media_asset_search_execution_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_media_asset_search_execution_updated_at BEFORE UPDATE ON dionysus.media_asset_search_execution FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_media_asset_search_execution_updated_at ON media_asset_search_execution; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_media_asset_search_execution_updated_at ON dionysus.media_asset_search_execution IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: media_asset set_dionysus_media_asset_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_media_asset_updated_at BEFORE UPDATE ON dionysus.media_asset FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_media_asset_updated_at ON media_asset; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_media_asset_updated_at ON dionysus.media_asset IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: media_asset_workflow_step set_dionysus_media_asset_workflow_step_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_media_asset_workflow_step_updated_at BEFORE UPDATE ON dionysus.media_asset_workflow_step FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_media_asset_workflow_step_updated_at ON media_asset_workflow_step; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_media_asset_workflow_step_updated_at ON dionysus.media_asset_workflow_step IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: media_asset_workflow set_dionysus_media_asset_workflow_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_media_asset_workflow_updated_at BEFORE UPDATE ON dionysus.media_asset_workflow FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_media_asset_workflow_updated_at ON media_asset_workflow; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_media_asset_workflow_updated_at ON dionysus.media_asset_workflow IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: metadata_fetch_status set_dionysus_metadata_locks_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_metadata_locks_updated_at BEFORE UPDATE ON dionysus.metadata_fetch_status FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_metadata_locks_updated_at ON metadata_fetch_status; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_metadata_locks_updated_at ON dionysus.metadata_fetch_status IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: metadata_workflow_step set_dionysus_metadata_workflow_step_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_metadata_workflow_step_updated_at BEFORE UPDATE ON dionysus.metadata_workflow_step FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_metadata_workflow_step_updated_at ON metadata_workflow_step; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_metadata_workflow_step_updated_at ON dionysus.metadata_workflow_step IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: metadata_workflow set_dionysus_metadata_workflow_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_metadata_workflow_updated_at BEFORE UPDATE ON dionysus.metadata_workflow FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_metadata_workflow_updated_at ON metadata_workflow; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_metadata_workflow_updated_at ON dionysus.metadata_workflow IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_alternative_titles set_dionysus_movie_alternative_titles_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_alternative_titles_updated_at BEFORE UPDATE ON dionysus.movie_alternative_titles FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_alternative_titles_updated_at ON movie_alternative_titles; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_alternative_titles_updated_at ON dionysus.movie_alternative_titles IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_cast set_dionysus_movie_cast_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_cast_updated_at BEFORE UPDATE ON dionysus.movie_cast FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_cast_updated_at ON movie_cast; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_cast_updated_at ON dionysus.movie_cast IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_crew set_dionysus_movie_crew_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_crew_updated_at BEFORE UPDATE ON dionysus.movie_crew FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_crew_updated_at ON movie_crew; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_crew_updated_at ON dionysus.movie_crew IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_external_ids set_dionysus_movie_external_ids_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_external_ids_updated_at BEFORE UPDATE ON dionysus.movie_external_ids FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_external_ids_updated_at ON movie_external_ids; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_external_ids_updated_at ON dionysus.movie_external_ids IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_genres set_dionysus_movie_genres_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_genres_updated_at BEFORE UPDATE ON dionysus.movie_genres FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_genres_updated_at ON movie_genres; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_genres_updated_at ON dionysus.movie_genres IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_images set_dionysus_movie_images_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_images_updated_at BEFORE UPDATE ON dionysus.movie_images FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_images_updated_at ON movie_images; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_images_updated_at ON dionysus.movie_images IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_keywords set_dionysus_movie_keywords_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_keywords_updated_at BEFORE UPDATE ON dionysus.movie_keywords FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_keywords_updated_at ON movie_keywords; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_keywords_updated_at ON dionysus.movie_keywords IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_production_companies set_dionysus_movie_production_companies_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_production_companies_updated_at BEFORE UPDATE ON dionysus.movie_production_companies FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_production_companies_updated_at ON movie_production_companies; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_production_companies_updated_at ON dionysus.movie_production_companies IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_production_countries set_dionysus_movie_production_countries_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_production_countries_updated_at BEFORE UPDATE ON dionysus.movie_production_countries FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_production_countries_updated_at ON movie_production_countries; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_production_countries_updated_at ON dionysus.movie_production_countries IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_recommendations set_dionysus_movie_recommendations_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_movie_recommendations_updated_at BEFORE UPDATE ON dionysus.movie_recommendations FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_recommendations_updated_at ON movie_recommendations; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_movie_recommendations_updated_at ON dionysus.movie_recommendations IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_release_dates set_dionysus_movie_release_dates_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_release_dates_updated_at BEFORE UPDATE ON dionysus.movie_release_dates FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_release_dates_updated_at ON movie_release_dates; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_release_dates_updated_at ON dionysus.movie_release_dates IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_spoken_languages set_dionysus_movie_spoken_languages_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_spoken_languages_updated_at BEFORE UPDATE ON dionysus.movie_spoken_languages FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_spoken_languages_updated_at ON movie_spoken_languages; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_spoken_languages_updated_at ON dionysus.movie_spoken_languages IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movie_videos set_dionysus_movie_videos_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movie_videos_updated_at BEFORE UPDATE ON dionysus.movie_videos FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movie_videos_updated_at ON movie_videos; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movie_videos_updated_at ON dionysus.movie_videos IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: movies set_dionysus_movies_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_movies_updated_at BEFORE UPDATE ON dionysus.movies FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_movies_updated_at ON movies; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_movies_updated_at ON dionysus.movies IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: network_alternative_names set_dionysus_network_alternative_name_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_network_alternative_name_updated_at BEFORE UPDATE ON dionysus.network_alternative_names FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_network_alternative_name_updated_at ON network_alternative_names; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_network_alternative_name_updated_at ON dionysus.network_alternative_names IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: network_images set_dionysus_network_images_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_network_images_updated_at BEFORE UPDATE ON dionysus.network_images FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_network_images_updated_at ON network_images; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_network_images_updated_at ON dionysus.network_images IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: networks set_dionysus_networks_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_networks_updated_at BEFORE UPDATE ON dionysus.networks FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_networks_updated_at ON networks; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_networks_updated_at ON dionysus.networks IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: people set_dionysus_people_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_people_updated_at BEFORE UPDATE ON dionysus.people FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_people_updated_at ON people; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_people_updated_at ON dionysus.people IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: person_external_ids set_dionysus_persobn_external_ids_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_persobn_external_ids_updated_at BEFORE UPDATE ON dionysus.person_external_ids FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_persobn_external_ids_updated_at ON person_external_ids; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_persobn_external_ids_updated_at ON dionysus.person_external_ids IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: person_aka set_dionysus_person_aka_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_person_aka_updated_at BEFORE UPDATE ON dionysus.person_aka FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_person_aka_updated_at ON person_aka; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_person_aka_updated_at ON dionysus.person_aka IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: person_images set_dionysus_person_images_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_person_images_updated_at BEFORE UPDATE ON dionysus.person_images FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_person_images_updated_at ON person_images; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_person_images_updated_at ON dionysus.person_images IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: production_companies set_dionysus_production_companies_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_production_companies_updated_at BEFORE UPDATE ON dionysus.production_companies FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_production_companies_updated_at ON production_companies; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_production_companies_updated_at ON dionysus.production_companies IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: production_company_alternative_names set_dionysus_production_company_alternative_names_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_production_company_alternative_names_updated_at BEFORE UPDATE ON dionysus.production_company_alternative_names FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_production_company_alternative_names_updated_at ON production_company_alternative_names; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_production_company_alternative_names_updated_at ON dionysus.production_company_alternative_names IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: production_company_logos set_dionysus_production_company_logos_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_production_company_logos_updated_at BEFORE UPDATE ON dionysus.production_company_logos FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_production_company_logos_updated_at ON production_company_logos; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_production_company_logos_updated_at ON dionysus.production_company_logos IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_episode_cast set_dionysus_tv_episode_credits_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_episode_credits_updated_at BEFORE UPDATE ON dionysus.tv_episode_cast FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_episode_credits_updated_at ON tv_episode_cast; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_episode_credits_updated_at ON dionysus.tv_episode_cast IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_episode_crew set_dionysus_tv_episode_crew_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_episode_crew_updated_at BEFORE UPDATE ON dionysus.tv_episode_crew FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_episode_crew_updated_at ON tv_episode_crew; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_episode_crew_updated_at ON dionysus.tv_episode_crew IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_episode_external_ids set_dionysus_tv_episode_external_ids_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_episode_external_ids_updated_at BEFORE UPDATE ON dionysus.tv_episode_external_ids FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_episode_external_ids_updated_at ON tv_episode_external_ids; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_episode_external_ids_updated_at ON dionysus.tv_episode_external_ids IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_episode_guest_stars set_dionysus_tv_episode_guest_stars_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_episode_guest_stars_updated_at BEFORE UPDATE ON dionysus.tv_episode_guest_stars FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_episode_guest_stars_updated_at ON tv_episode_guest_stars; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_episode_guest_stars_updated_at ON dionysus.tv_episode_guest_stars IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_episode_images set_dionysus_tv_episode_images_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_episode_images_updated_at BEFORE UPDATE ON dionysus.tv_episode_images FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_episode_images_updated_at ON tv_episode_images; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_episode_images_updated_at ON dionysus.tv_episode_images IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_episode_videos set_dionysus_tv_episode_videos_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_episode_videos_updated_at BEFORE UPDATE ON dionysus.tv_episode_videos FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_episode_videos_updated_at ON tv_episode_videos; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_episode_videos_updated_at ON dionysus.tv_episode_videos IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_episodes set_dionysus_tv_episodes_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_episodes_updated_at BEFORE UPDATE ON dionysus.tv_episodes FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_episodes_updated_at ON tv_episodes; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_episodes_updated_at ON dionysus.tv_episodes IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_season_cast_roles set_dionysus_tv_season_cast_roles_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_tv_season_cast_roles_updated_at BEFORE UPDATE ON dionysus.tv_season_cast_roles FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_season_cast_roles_updated_at ON tv_season_cast_roles; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_tv_season_cast_roles_updated_at ON dionysus.tv_season_cast_roles IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_season_cast set_dionysus_tv_season_cast_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_season_cast_updated_at BEFORE UPDATE ON dionysus.tv_season_cast FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_season_cast_updated_at ON tv_season_cast; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_season_cast_updated_at ON dionysus.tv_season_cast IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_season_crew_jobs set_dionysus_tv_season_crew_jobs_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_tv_season_crew_jobs_updated_at BEFORE UPDATE ON dionysus.tv_season_crew_jobs FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_season_crew_jobs_updated_at ON tv_season_crew_jobs; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_tv_season_crew_jobs_updated_at ON dionysus.tv_season_crew_jobs IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_season_crew set_dionysus_tv_season_crew_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_season_crew_updated_at BEFORE UPDATE ON dionysus.tv_season_crew FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_season_crew_updated_at ON tv_season_crew; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_season_crew_updated_at ON dionysus.tv_season_crew IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_season_external_ids set_dionysus_tv_season_external_ids_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_season_external_ids_updated_at BEFORE UPDATE ON dionysus.tv_season_external_ids FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_season_external_ids_updated_at ON tv_season_external_ids; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_season_external_ids_updated_at ON dionysus.tv_season_external_ids IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_season_images set_dionysus_tv_season_images_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_season_images_updated_at BEFORE UPDATE ON dionysus.tv_season_images FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_season_images_updated_at ON tv_season_images; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_season_images_updated_at ON dionysus.tv_season_images IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_season_videos set_dionysus_tv_season_videos_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_season_videos_updated_at BEFORE UPDATE ON dionysus.tv_season_videos FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_season_videos_updated_at ON tv_season_videos; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_season_videos_updated_at ON dionysus.tv_season_videos IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_seasons set_dionysus_tv_seasons_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_seasons_updated_at BEFORE UPDATE ON dionysus.tv_seasons FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_seasons_updated_at ON tv_seasons; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_seasons_updated_at ON dionysus.tv_seasons IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_alternative_titles set_dionysus_tv_series_alternative_titles_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_alternative_titles_updated_at BEFORE UPDATE ON dionysus.tv_series_alternative_titles FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_alternative_titles_updated_at ON tv_series_alternative_titles; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_alternative_titles_updated_at ON dionysus.tv_series_alternative_titles IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_cast_roles set_dionysus_tv_series_cast_roles_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_tv_series_cast_roles_updated_at BEFORE UPDATE ON dionysus.tv_series_cast_roles FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_cast_roles_updated_at ON tv_series_cast_roles; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_tv_series_cast_roles_updated_at ON dionysus.tv_series_cast_roles IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_cast set_dionysus_tv_series_cast_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_cast_updated_at BEFORE UPDATE ON dionysus.tv_series_cast FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_cast_updated_at ON tv_series_cast; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_cast_updated_at ON dionysus.tv_series_cast IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_content_ratings set_dionysus_tv_series_content_ratings_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_content_ratings_updated_at BEFORE UPDATE ON dionysus.tv_series_content_ratings FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_content_ratings_updated_at ON tv_series_content_ratings; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_content_ratings_updated_at ON dionysus.tv_series_content_ratings IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_created_by set_dionysus_tv_series_created_by_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_created_by_updated_at BEFORE UPDATE ON dionysus.tv_series_created_by FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_created_by_updated_at ON tv_series_created_by; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_created_by_updated_at ON dionysus.tv_series_created_by IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_crew_jobs set_dionysus_tv_series_crew_jobs_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_tv_series_crew_jobs_updated_at BEFORE UPDATE ON dionysus.tv_series_crew_jobs FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_crew_jobs_updated_at ON tv_series_crew_jobs; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_tv_series_crew_jobs_updated_at ON dionysus.tv_series_crew_jobs IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_crew set_dionysus_tv_series_crew_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_crew_updated_at BEFORE UPDATE ON dionysus.tv_series_crew FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_crew_updated_at ON tv_series_crew; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_crew_updated_at ON dionysus.tv_series_crew IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_episode_run_times set_dionysus_tv_series_episode_run_times_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_episode_run_times_updated_at BEFORE UPDATE ON dionysus.tv_series_episode_run_times FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_episode_run_times_updated_at ON tv_series_episode_run_times; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_episode_run_times_updated_at ON dionysus.tv_series_episode_run_times IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_external_ids set_dionysus_tv_series_external_ids_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_external_ids_updated_at BEFORE UPDATE ON dionysus.tv_series_external_ids FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_external_ids_updated_at ON tv_series_external_ids; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_external_ids_updated_at ON dionysus.tv_series_external_ids IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_genres set_dionysus_tv_series_genres_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_genres_updated_at BEFORE UPDATE ON dionysus.tv_series_genres FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_genres_updated_at ON tv_series_genres; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_genres_updated_at ON dionysus.tv_series_genres IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_images set_dionysus_tv_series_images_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_images_updated_at BEFORE UPDATE ON dionysus.tv_series_images FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_images_updated_at ON tv_series_images; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_images_updated_at ON dionysus.tv_series_images IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_keywords set_dionysus_tv_series_keywords_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_keywords_updated_at BEFORE UPDATE ON dionysus.tv_series_keywords FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_keywords_updated_at ON tv_series_keywords; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_keywords_updated_at ON dionysus.tv_series_keywords IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_languages set_dionysus_tv_series_languages_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_languages_updated_at BEFORE UPDATE ON dionysus.tv_series_languages FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_languages_updated_at ON tv_series_languages; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_languages_updated_at ON dionysus.tv_series_languages IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_networks set_dionysus_tv_series_networks_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_networks_updated_at BEFORE UPDATE ON dionysus.tv_series_networks FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_networks_updated_at ON tv_series_networks; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_networks_updated_at ON dionysus.tv_series_networks IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_origin_countries set_dionysus_tv_series_origin_countries_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_origin_countries_updated_at BEFORE UPDATE ON dionysus.tv_series_origin_countries FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_origin_countries_updated_at ON tv_series_origin_countries; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_origin_countries_updated_at ON dionysus.tv_series_origin_countries IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_production_companies set_dionysus_tv_series_production_companies_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_production_companies_updated_at BEFORE UPDATE ON dionysus.tv_series_production_companies FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_production_companies_updated_at ON tv_series_production_companies; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_production_companies_updated_at ON dionysus.tv_series_production_companies IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_production_countries set_dionysus_tv_series_production_countries_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_production_countries_updated_at BEFORE UPDATE ON dionysus.tv_series_production_countries FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_production_countries_updated_at ON tv_series_production_countries; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_production_countries_updated_at ON dionysus.tv_series_production_countries IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_recommendations set_dionysus_tv_series_recommendations_updated_at; Type: TRIGGER; Schema: dionysus; Owner: olympus
--

CREATE TRIGGER set_dionysus_tv_series_recommendations_updated_at BEFORE UPDATE ON dionysus.tv_series_recommendations FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_recommendations_updated_at ON tv_series_recommendations; Type: COMMENT; Schema: dionysus; Owner: olympus
--

COMMENT ON TRIGGER set_dionysus_tv_series_recommendations_updated_at ON dionysus.tv_series_recommendations IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_spoken_languages set_dionysus_tv_series_spoken_languages_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_spoken_languages_updated_at BEFORE UPDATE ON dionysus.tv_series_spoken_languages FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_spoken_languages_updated_at ON tv_series_spoken_languages; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_spoken_languages_updated_at ON dionysus.tv_series_spoken_languages IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series set_dionysus_tv_series_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_updated_at BEFORE UPDATE ON dionysus.tv_series FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_updated_at ON tv_series; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_updated_at ON dionysus.tv_series IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: tv_series_videos set_dionysus_tv_series_videos_updated_at; Type: TRIGGER; Schema: dionysus; Owner: postgres
--

CREATE TRIGGER set_dionysus_tv_series_videos_updated_at BEFORE UPDATE ON dionysus.tv_series_videos FOR EACH ROW EXECUTE FUNCTION dionysus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_dionysus_tv_series_videos_updated_at ON tv_series_videos; Type: COMMENT; Schema: dionysus; Owner: postgres
--

COMMENT ON TRIGGER set_dionysus_tv_series_videos_updated_at ON dionysus.tv_series_videos IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: meeting_notes set_minerva_meeting_notes_updated_at; Type: TRIGGER; Schema: minerva; Owner: postgres
--

CREATE TRIGGER set_minerva_meeting_notes_updated_at BEFORE UPDATE ON minerva.meeting_notes FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_minerva_meeting_notes_updated_at ON meeting_notes; Type: COMMENT; Schema: minerva; Owner: postgres
--

COMMENT ON TRIGGER set_minerva_meeting_notes_updated_at ON minerva.meeting_notes IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: notes set_minerva_notes_updated_at; Type: TRIGGER; Schema: minerva; Owner: postgres
--

CREATE TRIGGER set_minerva_notes_updated_at BEFORE UPDATE ON minerva.notes FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_minerva_notes_updated_at ON notes; Type: COMMENT; Schema: minerva; Owner: postgres
--

COMMENT ON TRIGGER set_minerva_notes_updated_at ON minerva.notes IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: notification_settings set_olympus_notification_settings_updated_at; Type: TRIGGER; Schema: olympus; Owner: olympus
--

CREATE TRIGGER set_olympus_notification_settings_updated_at BEFORE UPDATE ON olympus.notification_settings FOR EACH ROW EXECUTE FUNCTION olympus.set_current_timestamp_updated_at();


--
-- Name: TRIGGER set_olympus_notification_settings_updated_at ON notification_settings; Type: COMMENT; Schema: olympus; Owner: olympus
--

COMMENT ON TRIGGER set_olympus_notification_settings_updated_at ON olympus.notification_settings IS 'trigger to set value of column "updated_at" to current timestamp on row update';


--
-- Name: note_associations note_associations_note_id_fkey; Type: FK CONSTRAINT; Schema: minerva; Owner: postgres
--

ALTER TABLE ONLY minerva.note_associations
    ADD CONSTRAINT note_associations_note_id_fkey FOREIGN KEY (note_id) REFERENCES minerva.notes(id) ON UPDATE RESTRICT ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
