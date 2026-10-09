-- A view cannot lose a column in place.
DROP VIEW minerva.mail_proposals;
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
DROP TABLE minerva.mail_decisions;
DROP TABLE minerva.mail_change_labels;
DROP TABLE minerva.mail_changes;
DROP TABLE minerva.mail_change_batches;
