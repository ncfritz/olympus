-- The places each user keeps a forecast for (ADR 0024). A user's own list:
-- the API scopes every read and write by the caller, and Hasura grants
-- nothing beyond admin.

CREATE TABLE olympus.weather_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    label text NOT NULL,
    -- Where it came from in Google, when it did: the name is Google's
    -- formatted address, kept to show under a label the user changed.
    place_id text,
    place_name text,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    position integer NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weather_locations_label_check CHECK (length(btrim(label)) > 0),
    CONSTRAINT weather_locations_latitude_check CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT weather_locations_longitude_check CHECK (longitude BETWEEN -180 AND 180)
);

ALTER TABLE ONLY olympus.weather_locations
    ADD CONSTRAINT weather_locations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY olympus.weather_locations
    ADD CONSTRAINT weather_locations_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- Deferred, so a reorder can pass through a moment where two locations
-- share a position and be checked only when it commits.
ALTER TABLE ONLY olympus.weather_locations
    ADD CONSTRAINT weather_locations_user_id_position_key UNIQUE (user_id, position)
    DEFERRABLE INITIALLY DEFERRED;

-- At most one default per user.
CREATE UNIQUE INDEX weather_locations_one_default_key
    ON olympus.weather_locations USING btree (user_id) WHERE is_default;

CREATE TRIGGER set_olympus_weather_locations_updated_at BEFORE UPDATE ON olympus.weather_locations
    FOR EACH ROW EXECUTE FUNCTION olympus.set_current_timestamp_updated_at();
