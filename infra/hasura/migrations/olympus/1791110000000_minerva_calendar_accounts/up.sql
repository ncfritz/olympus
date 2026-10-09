-- Calendar accounts and who owns them (ADR 0028, calendar users plan
-- phase 4). The sync agent holds the credentials; Olympus holds which
-- user each account belongs to, how that was proven, and the sign-ins and
-- claims in flight. The API scopes every read and write; Hasura grants
-- nothing beyond admin.

-- One per provider sign-in, by its subject (Google's sub; Microsoft's
-- <tid>:<oid>), never by its email. An account the agent holds that no one
-- has proven is theirs has no user; its events are not stored.
CREATE TABLE minerva.calendar_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    subject text NOT NULL,
    -- The label the agent keeps it under: its verified email at sign-in.
    email text NOT NULL,
    user_id uuid,
    verified_at timestamp with time zone,
    verification_method text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_accounts_provider_check CHECK (provider IN ('google', 'microsoft')),
    CONSTRAINT calendar_accounts_subject_check CHECK (length(subject) BETWEEN 1 AND 300),
    CONSTRAINT calendar_accounts_verification_method_check CHECK (
        verification_method IN ('sign_in', 'consent', 'claim_email', 'claim_consent')
    ),
    -- Owned exactly when proven: a user, a time and a method, or none.
    CONSTRAINT calendar_accounts_verified_check CHECK (
        (user_id IS NULL AND verified_at IS NULL AND verification_method IS NULL)
        OR (user_id IS NOT NULL AND verified_at IS NOT NULL AND verification_method IS NOT NULL)
    )
);

ALTER TABLE ONLY minerva.calendar_accounts
    ADD CONSTRAINT calendar_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.calendar_accounts
    ADD CONSTRAINT calendar_accounts_provider_subject_key UNIQUE (provider, subject);
ALTER TABLE ONLY minerva.calendar_accounts
    ADD CONSTRAINT calendar_accounts_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX calendar_accounts_user_id_idx ON minerva.calendar_accounts USING btree (user_id);
-- A claim names the account by its email (ADR 0028).
CREATE INDEX calendar_accounts_email_idx ON minerva.calendar_accounts USING btree (lower(email));

CREATE TRIGGER set_minerva_calendar_accounts_updated_at BEFORE UPDATE ON minerva.calendar_accounts
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A sign-in at the provider that the API started for a user: connecting
-- a new account, or signing an existing one in again. The callback finds
-- it by its state, which is single use and short-lived; only the state's
-- hash is kept. The PKCE verifier is kept until the callback spends it.
CREATE TABLE minerva.calendar_account_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    state_hash text NOT NULL,
    code_verifier text NOT NULL,
    -- The account being signed in again; none when connecting a new one.
    account_id uuid,
    -- Where the site wants the browser back.
    return_to text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_account_connections_provider_check CHECK (provider IN ('google', 'microsoft'))
);

ALTER TABLE ONLY minerva.calendar_account_connections
    ADD CONSTRAINT calendar_account_connections_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.calendar_account_connections
    ADD CONSTRAINT calendar_account_connections_state_hash_key UNIQUE (state_hash);
ALTER TABLE ONLY minerva.calendar_account_connections
    ADD CONSTRAINT calendar_account_connections_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.calendar_account_connections
    ADD CONSTRAINT calendar_account_connections_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.calendar_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER set_minerva_calendar_account_connections_updated_at BEFORE UPDATE ON minerva.calendar_account_connections
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A claim of an account by email (ADR 0028; used from phase 6). Only the
-- link's token hash is kept. An account has at most one open claim.
CREATE TABLE minerva.calendar_account_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    confirmed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calendar_account_claims_closed_check CHECK (
        confirmed_at IS NULL OR cancelled_at IS NULL
    )
);

ALTER TABLE ONLY minerva.calendar_account_claims
    ADD CONSTRAINT calendar_account_claims_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.calendar_account_claims
    ADD CONSTRAINT calendar_account_claims_token_hash_key UNIQUE (token_hash);
ALTER TABLE ONLY minerva.calendar_account_claims
    ADD CONSTRAINT calendar_account_claims_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.calendar_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.calendar_account_claims
    ADD CONSTRAINT calendar_account_claims_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE UNIQUE INDEX calendar_account_claims_open_key
    ON minerva.calendar_account_claims USING btree (account_id)
    WHERE confirmed_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX calendar_account_claims_user_id_created_at_idx
    ON minerva.calendar_account_claims USING btree (user_id, created_at);

CREATE TRIGGER set_minerva_calendar_account_claims_updated_at BEFORE UPDATE ON minerva.calendar_account_claims
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- The account a meeting came through. None for a meeting made in Olympus
-- or imported from the old sync; none again if the account goes.
ALTER TABLE minerva.meetings ADD COLUMN account_id uuid;
ALTER TABLE ONLY minerva.meetings
    ADD CONSTRAINT meetings_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.calendar_accounts(id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX meetings_account_id_idx ON minerva.meetings USING btree (account_id);
