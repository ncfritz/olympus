-- Each thread's sets of user labels (docs/plans/email-management, the
-- Re-classification page's Threads tab): per set, how many of the
-- thread's messages carry it, one row per label in it, and one row with no
-- label for the messages without any. The audit counts these sets; this
-- names them.
CREATE VIEW minerva.mail_thread_label_sets AS
WITH per_message AS (
    SELECT m.account_id, m.thread_id, m.id,
           coalesce(string_agg(l.id::text, ',' ORDER BY l.id), '') AS set_key
    FROM minerva.mail_messages m
    LEFT JOIN minerva.mail_message_labels ml ON ml.message_id = m.id
    LEFT JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.type = 'user'
    GROUP BY m.account_id, m.thread_id, m.id
), sets AS (
    SELECT account_id, thread_id, set_key, count(*)::integer AS messages
    FROM per_message
    GROUP BY account_id, thread_id, set_key
)
SELECT s.account_id, s.thread_id, s.set_key, s.messages, l.name AS label
FROM sets s
LEFT JOIN LATERAL unnest(string_to_array(nullif(s.set_key, ''), ',')) AS k(label_id) ON true
LEFT JOIN minerva.mail_labels l ON l.id::text = k.label_id;
