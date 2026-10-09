-- The classifier's suggestions over the whole mailbox (docs/plans/
-- email-management phase 4). The classifier scores every message with a
-- model that never saw it and posts, per message and label, where it
-- confidently disagrees with the labels: a label to add or to remove.
-- Like the audit, a kept run per account: a run is `building` while the
-- classifier posts to it, and publishing it makes it `ready` and drops the
-- account's runs before it, so the page always reads one set.

CREATE TABLE minerva.mail_suggestion_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    -- The classifier's model run and feature version the scores came from.
    model_run text NOT NULL,
    feature_version text NOT NULL,
    status text DEFAULT 'building' NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    messages_scored integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_suggestion_runs_status_check CHECK (status IN ('building', 'ready')),
    CONSTRAINT mail_suggestion_runs_finished_check CHECK (
        (status = 'ready') = (finished_at IS NOT NULL)
        AND (status = 'ready') = (messages_scored IS NOT NULL)
    ),
    CONSTRAINT mail_suggestion_runs_model_run_check CHECK (length(model_run) BETWEEN 1 AND 100),
    CONSTRAINT mail_suggestion_runs_feature_version_check CHECK (length(feature_version) BETWEEN 1 AND 50),
    CONSTRAINT mail_suggestion_runs_messages_scored_check CHECK (messages_scored >= 0)
);
ALTER TABLE ONLY minerva.mail_suggestion_runs ADD CONSTRAINT mail_suggestion_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_suggestion_runs
    ADD CONSTRAINT mail_suggestion_runs_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_suggestion_runs_account_id_idx ON minerva.mail_suggestion_runs USING btree (account_id, status);
CREATE TRIGGER set_minerva_mail_suggestion_runs_updated_at BEFORE UPDATE ON minerva.mail_suggestion_runs
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

CREATE TABLE minerva.mail_suggestions (
    run_id uuid NOT NULL,
    message_id uuid NOT NULL,
    label_id uuid NOT NULL,
    action text NOT NULL,
    -- How sure the classifier is: its score for an addition, one less its
    -- score for a removal.
    confidence numeric(4, 3) NOT NULL,
    -- At or above the label's threshold: applied unless unticked (design.md).
    ticked boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_suggestions_action_check CHECK (action IN ('add', 'remove')),
    CONSTRAINT mail_suggestions_confidence_check CHECK (confidence BETWEEN 0 AND 1)
);
ALTER TABLE ONLY minerva.mail_suggestions
    ADD CONSTRAINT mail_suggestions_pkey PRIMARY KEY (run_id, message_id, label_id);
ALTER TABLE ONLY minerva.mail_suggestions
    ADD CONSTRAINT mail_suggestions_run_id_fkey FOREIGN KEY (run_id)
    REFERENCES minerva.mail_suggestion_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_suggestions
    ADD CONSTRAINT mail_suggestions_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_suggestions
    ADD CONSTRAINT mail_suggestions_label_id_fkey FOREIGN KEY (label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_suggestions_label_id_idx ON minerva.mail_suggestions USING btree (label_id);
CREATE INDEX mail_suggestions_message_id_idx ON minerva.mail_suggestions USING btree (message_id);
CREATE TRIGGER set_minerva_mail_suggestions_updated_at BEFORE UPDATE ON minerva.mail_suggestions
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Every proposed label change, whatever proposed it: the latest audit's
-- (rule `sender`, with its sender counts) and the latest published
-- classifier run's (rule `classifier`, with whether it is ticked). The
-- Re-classification page reads this.
CREATE VIEW minerva.mail_proposals AS
    SELECT r.account_id, c.message_id, c.label_id, c.action, c.rule, c.confidence,
           c.sender_messages, c.sender_label_messages, NULL::boolean AS ticked
    FROM minerva.mail_audit_changes c
    JOIN minerva.mail_audit_runs r ON r.id = c.run_id
    UNION ALL
    SELECT r.account_id, s.message_id, s.label_id, s.action, 'classifier', s.confidence,
           NULL::integer, NULL::integer, s.ticked
    FROM minerva.mail_suggestions s
    JOIN minerva.mail_suggestion_runs r ON r.id = s.run_id AND r.status = 'ready';

-- The summary and the label tree count every proposal, the classifier's
-- with the audit's, and the summary says when the classifier last ran.
ALTER TABLE minerva.mail_audit_summary_type
    ADD COLUMN classifier_finished_at timestamp with time zone,
    ADD COLUMN classifier_changes bigint DEFAULT 0 NOT NULL;

CREATE OR REPLACE FUNCTION minerva.mail_audit_summary(for_user uuid, high numeric)
    RETURNS SETOF minerva.mail_audit_summary_type LANGUAGE sql STABLE AS $$
    WITH accounts AS (
        SELECT id FROM minerva.mail_accounts WHERE user_id = for_user
    ),
    runs AS (
        SELECT r.* FROM minerva.mail_audit_runs r WHERE r.account_id IN (SELECT id FROM accounts)
    ),
    proposals AS (
        SELECT p.* FROM minerva.mail_proposals p WHERE p.account_id IN (SELECT id FROM accounts)
    )
    SELECT min(started_at), max(finished_at),
           sum(messages_examined), sum(consistent_senders),
           (SELECT count(*) FROM proposals),
           (SELECT count(*) FROM proposals WHERE action = 'add'),
           (SELECT count(*) FROM proposals WHERE action = 'remove'),
           (SELECT count(*) FROM proposals WHERE confidence >= high),
           (SELECT count(DISTINCT message_id) FROM proposals),
           (SELECT count(*) FROM minerva.mail_audit_merges g WHERE g.run_id IN (SELECT id FROM runs)),
           (SELECT count(*) FROM minerva.mail_audit_threads t WHERE t.run_id IN (SELECT id FROM runs)),
           (SELECT max(s.finished_at) FROM minerva.mail_suggestion_runs s
             WHERE s.account_id IN (SELECT id FROM accounts) AND s.status = 'ready'),
           (SELECT count(*) FROM proposals WHERE rule = 'classifier')
    FROM runs
    HAVING count(*) > 0
$$;

CREATE OR REPLACE FUNCTION minerva.mail_audit_labels(for_user uuid, high numeric)
    RETURNS SETOF minerva.mail_audit_label_type LANGUAGE sql STABLE AS $$
    WITH labels AS (
        SELECT l.* FROM minerva.mail_labels l
        JOIN minerva.mail_accounts a ON a.id = l.account_id AND a.user_id = for_user
        WHERE l.type = 'user'
    ),
    runs AS (
        SELECT r.id FROM minerva.mail_audit_runs r
        JOIN minerva.mail_accounts a ON a.id = r.account_id AND a.user_id = for_user
    ),
    sizes AS (
        SELECT ml.label_id, count(*) AS messages, max(m.received_at) AS last_received_at
        FROM minerva.mail_message_labels ml
        JOIN labels ON labels.id = ml.label_id
        JOIN minerva.mail_messages m ON m.id = ml.message_id
        GROUP BY ml.label_id
    ),
    proposed AS (
        SELECT p.label_id,
               count(*) FILTER (WHERE p.action = 'add') AS proposed_in,
               count(*) FILTER (WHERE p.action = 'remove') AS proposed_out,
               count(*) FILTER (WHERE p.confidence >= high) AS high_confidence
        FROM minerva.mail_proposals p
        WHERE p.label_id IN (SELECT id FROM labels)
        GROUP BY p.label_id
    ),
    merging AS (
        SELECT from_label_id AS label_id FROM minerva.mail_audit_merges WHERE run_id IN (SELECT id FROM runs)
        UNION
        SELECT into_label_id FROM minerva.mail_audit_merges WHERE run_id IN (SELECT id FROM runs)
    )
    SELECT labels.name, coalesce(sizes.messages, 0), sizes.last_received_at,
           coalesce(proposed.proposed_in, 0), coalesce(proposed.proposed_out, 0),
           coalesce(proposed.high_confidence, 0),
           EXISTS (SELECT 1 FROM merging WHERE merging.label_id = labels.id)
    FROM labels
    LEFT JOIN sizes ON sizes.label_id = labels.id
    LEFT JOIN proposed ON proposed.label_id = labels.id
    ORDER BY labels.name
$$;
