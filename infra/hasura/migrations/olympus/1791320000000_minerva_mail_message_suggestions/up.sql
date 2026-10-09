-- Suggestions for new mail (docs/plans/email-management phase 5): the
-- labels the serving model suggests for a message as it arrives, for the
-- inbox. Unlike the mailbox-wide runs (mail_suggestions), these are the
-- message's whole suggestion, not where it disagrees with its labels: a
-- label it has already is listed too.
--
-- Keyed by account and Gmail ID, not the message row: the agent posts a
-- message's suggestions just after publishing it to mail.messages, and the
-- message can be stored after its suggestions arrive. Deleting a message
-- deletes its score (the API does it with the message).

-- A message scored: by which model run and when. A message scored with no
-- label good enough has a score and no suggestions.
CREATE TABLE minerva.mail_message_scores (
    account_id uuid NOT NULL,
    gmail_id text NOT NULL,
    model_run text NOT NULL,
    feature_version text NOT NULL,
    scored_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_message_scores_gmail_id_check CHECK (gmail_id ~ '^[0-9a-f]{1,16}$'),
    CONSTRAINT mail_message_scores_model_run_check CHECK (length(model_run) BETWEEN 1 AND 100),
    CONSTRAINT mail_message_scores_feature_version_check CHECK (length(feature_version) BETWEEN 1 AND 50)
);
ALTER TABLE ONLY minerva.mail_message_scores
    ADD CONSTRAINT mail_message_scores_pkey PRIMARY KEY (account_id, gmail_id);
ALTER TABLE ONLY minerva.mail_message_scores
    ADD CONSTRAINT mail_message_scores_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_message_scores_updated_at BEFORE UPDATE ON minerva.mail_message_scores
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Each label suggested, best first.
CREATE TABLE minerva.mail_message_suggestions (
    account_id uuid NOT NULL,
    gmail_id text NOT NULL,
    label_id uuid NOT NULL,
    rank smallint NOT NULL,
    -- The calibrated score.
    score numeric(4, 3) NOT NULL,
    -- At or above the label's threshold: applied on approval unless unticked.
    ticked boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_message_suggestions_rank_check CHECK (rank >= 0),
    CONSTRAINT mail_message_suggestions_score_check CHECK (score BETWEEN 0 AND 1)
);
ALTER TABLE ONLY minerva.mail_message_suggestions
    ADD CONSTRAINT mail_message_suggestions_pkey PRIMARY KEY (account_id, gmail_id, label_id);
ALTER TABLE ONLY minerva.mail_message_suggestions
    ADD CONSTRAINT mail_message_suggestions_score_fkey FOREIGN KEY (account_id, gmail_id)
    REFERENCES minerva.mail_message_scores(account_id, gmail_id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_message_suggestions
    ADD CONSTRAINT mail_message_suggestions_label_id_fkey FOREIGN KEY (label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_message_suggestions_label_id_idx ON minerva.mail_message_suggestions USING btree (label_id);
CREATE TRIGGER set_minerva_mail_message_suggestions_updated_at BEFORE UPDATE ON minerva.mail_message_suggestions
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
