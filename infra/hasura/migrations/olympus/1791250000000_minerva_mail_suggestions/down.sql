DROP FUNCTION minerva.mail_audit_summary(uuid, numeric);
DROP FUNCTION minerva.mail_audit_labels(uuid, numeric);
ALTER TABLE minerva.mail_audit_summary_type DROP COLUMN classifier_changes, DROP COLUMN classifier_finished_at;
-- The audit's own summary and label tree, as 1791230000000 made them.
CREATE FUNCTION minerva.mail_audit_summary(for_user uuid, high numeric)
    RETURNS SETOF minerva.mail_audit_summary_type LANGUAGE sql STABLE AS $$
    WITH runs AS (
        SELECT r.* FROM minerva.mail_audit_runs r
        JOIN minerva.mail_accounts a ON a.id = r.account_id AND a.user_id = for_user
    )
    SELECT min(started_at), max(finished_at),
           sum(messages_examined), sum(consistent_senders),
           (SELECT count(*) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs)),
           (SELECT count(*) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs) AND c.action = 'add'),
           (SELECT count(*) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs) AND c.action = 'remove'),
           (SELECT count(*) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs) AND c.confidence >= high),
           (SELECT count(DISTINCT c.message_id) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs)),
           (SELECT count(*) FROM minerva.mail_audit_merges g WHERE g.run_id IN (SELECT id FROM runs)),
           (SELECT count(*) FROM minerva.mail_audit_threads t WHERE t.run_id IN (SELECT id FROM runs))
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
        SELECT c.label_id,
               count(*) FILTER (WHERE c.action = 'add') AS proposed_in,
               count(*) FILTER (WHERE c.action = 'remove') AS proposed_out,
               count(*) FILTER (WHERE c.confidence >= high) AS high_confidence
        FROM minerva.mail_audit_changes c
        WHERE c.run_id IN (SELECT id FROM runs)
        GROUP BY c.label_id
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

DROP VIEW minerva.mail_proposals;
DROP TABLE minerva.mail_suggestions;
DROP TABLE minerva.mail_suggestion_runs;
