-- The functions as 1791250000000 made them: dropped first, since they
-- return the rows the columns are leaving.
DROP FUNCTION minerva.mail_audit_summary(uuid, numeric);
DROP FUNCTION minerva.mail_audit_labels(uuid, numeric);
ALTER TABLE minerva.mail_audit_label_type DROP COLUMN processed;
ALTER TABLE minerva.mail_audit_summary_type DROP COLUMN processed;

CREATE FUNCTION minerva.mail_audit_summary(for_user uuid, high numeric)
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

CREATE FUNCTION minerva.mail_audit_labels(for_user uuid, high numeric)
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
