-- The inbox (docs/plans/email-management phase 5): what was decided about
-- each message's suggestion, and the view the Inbox page and the home
-- page's widget read.

-- A message's suggestion approved (its labels written, as the suggestion
-- said or amended) or skipped (left for now, Gmail unchanged). Phase 5's
-- learning reads these: an approval is a training example, an amendment
-- a correction.
CREATE TABLE minerva.mail_inbox_decisions (
    message_id uuid NOT NULL,
    account_id uuid NOT NULL,
    decision text NOT NULL,
    -- The model run whose suggestion was decided on; none if not scored.
    model_run text,
    -- Approved with labels other than the ticked suggestion's.
    amended boolean DEFAULT false NOT NULL,
    -- The batch that wrote it; none for a skip, or an approval that
    -- changed nothing in Gmail. Undoing the batch takes the decision back.
    batch_id uuid,
    user_id uuid NOT NULL,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_inbox_decisions_decision_check CHECK (decision IN ('approved', 'skipped')),
    CONSTRAINT mail_inbox_decisions_skipped_check CHECK (
        decision = 'approved' OR (batch_id IS NULL AND NOT amended)
    ),
    CONSTRAINT mail_inbox_decisions_model_run_check CHECK (model_run IS NULL OR length(model_run) BETWEEN 1 AND 100)
);
ALTER TABLE ONLY minerva.mail_inbox_decisions
    ADD CONSTRAINT mail_inbox_decisions_pkey PRIMARY KEY (message_id);
ALTER TABLE ONLY minerva.mail_inbox_decisions
    ADD CONSTRAINT mail_inbox_decisions_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_inbox_decisions
    ADD CONSTRAINT mail_inbox_decisions_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_inbox_decisions
    ADD CONSTRAINT mail_inbox_decisions_batch_id_fkey FOREIGN KEY (batch_id)
    REFERENCES minerva.mail_change_batches(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY minerva.mail_inbox_decisions
    ADD CONSTRAINT mail_inbox_decisions_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_inbox_decisions_account_id_idx
    ON minerva.mail_inbox_decisions USING btree (account_id, decision, decided_at);
CREATE INDEX mail_inbox_decisions_batch_id_idx ON minerva.mail_inbox_decisions USING btree (batch_id);
CREATE TRIGGER set_minerva_mail_inbox_decisions_updated_at BEFORE UPDATE ON minerva.mail_inbox_decisions
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Each message in the inbox, and each decided one wherever it is now: its
-- thread's size, when it was scored, its best ticked suggestion it does
-- not have yet (none: nothing to add), and what was decided.
CREATE VIEW minerva.mail_inbox AS
    SELECT m.id AS message_id, m.account_id, m.gmail_id, m.thread_id, m.received_at,
           m.in_inbox, m.unread,
           (SELECT count(*) FROM minerva.mail_messages t
             WHERE t.account_id = m.account_id AND t.thread_id = m.thread_id)::integer AS thread_size,
           s.scored_at, s.model_run,
           top.score AS top_score,
           d.decision, d.decided_at, d.amended
    FROM minerva.mail_messages m
    LEFT JOIN minerva.mail_message_scores s
        ON s.account_id = m.account_id AND s.gmail_id = m.gmail_id
    LEFT JOIN LATERAL (
        SELECT max(g.score) AS score
        FROM minerva.mail_message_suggestions g
        WHERE g.account_id = m.account_id AND g.gmail_id = m.gmail_id AND g.ticked
          AND NOT EXISTS (
              SELECT 1 FROM minerva.mail_message_labels ml
              WHERE ml.message_id = m.id AND ml.label_id = g.label_id
          )
    ) top ON true
    LEFT JOIN minerva.mail_inbox_decisions d ON d.message_id = m.id
    WHERE m.in_inbox OR d.decision IS NOT NULL;
