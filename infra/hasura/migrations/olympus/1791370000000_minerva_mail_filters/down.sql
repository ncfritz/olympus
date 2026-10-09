DROP VIEW minerva.mail_inbox;
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

DROP VIEW minerva.mail_filter_proposals;
DROP TABLE minerva.mail_filter_dismissals;
DROP TABLE minerva.mail_filters;
