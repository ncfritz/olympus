-- Authentication's own tables (ADR 0018): who may sign in, which provider
-- identities are linked to them, and their live sessions.
--
-- Only login, refresh and logout touch these. Services never do: a
-- service's roles come from the API's configuration, keyed by its
-- certificate's common name.

CREATE TABLE olympus.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text NOT NULL,
    email text NOT NULL,
    disabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY olympus.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- An identity links by verified email, and providers disagree about case.
CREATE UNIQUE INDEX users_email_key ON olympus.users USING btree (lower(email));

CREATE TRIGGER set_olympus_users_updated_at BEFORE UPDATE ON olympus.users
    FOR EACH ROW EXECUTE FUNCTION olympus.set_current_timestamp_updated_at();

-- A row per role, not an array: the schema is tables and columns.
CREATE TABLE olympus.user_roles (
    user_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY olympus.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role);

ALTER TABLE ONLY olympus.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- One per provider account. The email is what it was at link time, kept
-- for the audit trail: the link is by subject from then on, because a
-- provider may let someone change their address.
CREATE TABLE olympus.user_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    subject text NOT NULL,
    user_id uuid NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY olympus.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY olympus.user_identities
    ADD CONSTRAINT user_identities_provider_subject_key UNIQUE (provider, subject);

ALTER TABLE ONLY olympus.user_identities
    ADD CONSTRAINT user_identities_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX user_identities_user_id_idx ON olympus.user_identities USING btree (user_id);

CREATE TRIGGER set_olympus_user_identities_updated_at BEFORE UPDATE ON olympus.user_identities
    FOR EACH ROW EXECUTE FUNCTION olympus.set_current_timestamp_updated_at();

-- A session is a refresh token's lifetime. The token itself is never
-- stored, only its hash; previous_token_hash is the one it replaced, so
-- presenting a rotated token is detectable and revokes the session.
--
-- created_at is the token's `auth_time`: refresh carries it unchanged, so
-- an operation can require a recent sign-in.
CREATE TABLE olympus.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    client_id text NOT NULL,
    device_name text,
    refresh_token_hash text NOT NULL,
    previous_token_hash text,
    last_used_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY olympus.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY olympus.sessions
    ADD CONSTRAINT sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);

ALTER TABLE ONLY olympus.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE INDEX sessions_user_id_idx ON olympus.sessions USING btree (user_id);

-- Reuse detection looks a token up here when it is not the current one.
CREATE INDEX sessions_previous_token_hash_idx ON olympus.sessions
    USING btree (previous_token_hash) WHERE (previous_token_hash IS NOT NULL);

-- For expiring sessions on a schedule.
CREATE INDEX sessions_expires_at_idx ON olympus.sessions USING btree (expires_at)
    WHERE (revoked_at IS NULL);

CREATE TRIGGER set_olympus_sessions_updated_at BEFORE UPDATE ON olympus.sessions
    FOR EACH ROW EXECUTE FUNCTION olympus.set_current_timestamp_updated_at();
