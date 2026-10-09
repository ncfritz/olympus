-- Gmail filters (ADR 0030; docs/plans/email-management phase 7 step 4).
-- A sender whose approved inbox mail carries one label at least 99% of
-- the time, over at least 20 approvals, is proposed a filter: from that
-- sender, apply the label (and skip the inbox, if chosen). A filter made
-- is kept here with Gmail's ID; mail it labelled leaves review.

CREATE TABLE minerva.mail_filters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    from_address text NOT NULL,
    label_id uuid NOT NULL,
    skip_inbox boolean NOT NULL,
    gmail_filter_id text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_filters_from_address_check CHECK (
        from_address = lower(from_address) AND from_address ~ '^[^@\s]+@[^@\s]+$'
    )
);
ALTER TABLE ONLY minerva.mail_filters ADD CONSTRAINT mail_filters_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_filters
    ADD CONSTRAINT mail_filters_account_id_from_address_label_id_key UNIQUE (account_id, from_address, label_id);
ALTER TABLE ONLY minerva.mail_filters
    ADD CONSTRAINT mail_filters_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_filters
    ADD CONSTRAINT mail_filters_label_id_fkey FOREIGN KEY (label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_filters
    ADD CONSTRAINT mail_filters_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_filters_label_id_idx ON minerva.mail_filters USING btree (label_id);
CREATE TRIGGER set_minerva_mail_filters_updated_at BEFORE UPDATE ON minerva.mail_filters
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A proposal declined: not proposed again.
CREATE TABLE minerva.mail_filter_dismissals (
    account_id uuid NOT NULL,
    from_address text NOT NULL,
    label_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY minerva.mail_filter_dismissals
    ADD CONSTRAINT mail_filter_dismissals_pkey PRIMARY KEY (account_id, from_address, label_id);
ALTER TABLE ONLY minerva.mail_filter_dismissals
    ADD CONSTRAINT mail_filter_dismissals_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_filter_dismissals
    ADD CONSTRAINT mail_filter_dismissals_label_id_fkey FOREIGN KEY (label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_filter_dismissals_updated_at BEFORE UPDATE ON minerva.mail_filter_dismissals
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Each sender and label worth a filter: the share of the sender's
-- approved inbox mail that carries the label now.
CREATE VIEW minerva.mail_filter_proposals AS
    WITH approved AS (
        SELECT m.id, m.account_id, m.from_address, d.decided_at
        FROM minerva.mail_inbox_decisions d
        JOIN minerva.mail_messages m ON m.id = d.message_id
        WHERE d.decision = 'approved' AND m.from_address IS NOT NULL
    ), senders AS (
        SELECT account_id, from_address, count(*) AS decisions, max(decided_at) AS last_decided_at
        FROM approved
        GROUP BY account_id, from_address
        HAVING count(*) >= 20
    )
    SELECT s.account_id, s.from_address, l.id AS label_id, l.name AS label,
           s.decisions::integer AS decisions, count(*)::integer AS kept, s.last_decided_at
    FROM senders s
    JOIN approved a ON a.account_id = s.account_id AND a.from_address = s.from_address
    JOIN minerva.mail_message_labels ml ON ml.message_id = a.id
    JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.type = 'user' AND l.kind IN ('topical', 'state')
    WHERE NOT EXISTS (
              SELECT 1 FROM minerva.mail_filters f
              WHERE f.account_id = s.account_id AND f.from_address = s.from_address AND f.label_id = l.id
          )
      AND NOT EXISTS (
              SELECT 1 FROM minerva.mail_filter_dismissals x
              WHERE x.account_id = s.account_id AND x.from_address = s.from_address AND x.label_id = l.id
          )
    GROUP BY s.account_id, s.from_address, l.id, l.name, s.decisions, s.last_decided_at
    HAVING count(*) >= 0.99 * s.decisions;

CREATE OR REPLACE VIEW minerva.mail_inbox AS
    SELECT m.id AS message_id, m.account_id, m.gmail_id, m.thread_id, m.received_at,
           m.in_inbox, m.unread,
           (SELECT count(*) FROM minerva.mail_messages t
             WHERE t.account_id = m.account_id AND t.thread_id = m.thread_id)::integer AS thread_size,
           s.scored_at, s.model_run,
           top.score AS top_score,
           d.decision, d.decided_at, d.amended,
           -- From a sender with a filter, carrying its label: handled.
           EXISTS (
               SELECT 1 FROM minerva.mail_filters f
               JOIN minerva.mail_message_labels fl ON fl.message_id = m.id AND fl.label_id = f.label_id
               WHERE f.account_id = m.account_id AND f.from_address = m.from_address
           ) AS filtered
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
