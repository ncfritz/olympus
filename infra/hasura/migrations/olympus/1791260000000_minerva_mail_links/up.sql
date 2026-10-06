-- Linking a mail account to Gmail (docs/plans/email-management phase 1b;
-- ADR 0030, by ADR 0028's consent flow). The API starts a sign-in for a
-- signed-in user and keeps its state's hash and the PKCE verifier; the
-- callback takes it once. A linked account records Google's subject, which
-- a later sign-in must return, and when and with what scope it was linked.
-- The refresh token stays in the mail agent.

ALTER TABLE minerva.mail_accounts
    ADD COLUMN google_subject text,
    ADD COLUMN linked_at timestamp with time zone,
    ADD COLUMN link_scope text,
    ADD CONSTRAINT mail_accounts_linked_check CHECK (
        (google_subject IS NULL) = (linked_at IS NULL)
        AND (google_subject IS NULL) = (link_scope IS NULL)
    ),
    ADD CONSTRAINT mail_accounts_google_subject_key UNIQUE (google_subject);

CREATE TABLE minerva.mail_account_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    state_hash text NOT NULL,
    code_verifier text NOT NULL,
    -- Where the site wants the browser back.
    return_to text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY minerva.mail_account_connections
    ADD CONSTRAINT mail_account_connections_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_account_connections
    ADD CONSTRAINT mail_account_connections_state_hash_key UNIQUE (state_hash);
ALTER TABLE ONLY minerva.mail_account_connections
    ADD CONSTRAINT mail_account_connections_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_account_connections
    ADD CONSTRAINT mail_account_connections_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_account_connections_account_id_idx
    ON minerva.mail_account_connections USING btree (account_id);
CREATE TRIGGER set_minerva_mail_account_connections_updated_at BEFORE UPDATE ON minerva.mail_account_connections
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
