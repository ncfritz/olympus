DROP VIEW minerva.mail_payment_matches;
CREATE VIEW minerva.mail_payment_matches AS
    SELECT c.id AS confirmation_id, c.account_id, c.gmail_id AS confirmation_gmail_id,
           c.received_at AS confirmed_at, c.in_inbox AS confirmation_in_inbox,
           b.id AS bill_id, b.gmail_id AS bill_gmail_id, b.received_at AS bill_received_at,
           b.from_label_id, b.from_label, b.to_label_id, b.to_label, b.starred AS bill_starred
    FROM minerva.mail_messages c
    JOIN LATERAL (
        SELECT bm.id, bm.gmail_id, bm.received_at, bm.starred,
               l.id AS from_label_id, l.name AS from_label,
               t.to_label_id, t.to_label
        FROM minerva.mail_messages bm
        JOIN minerva.mail_message_labels ml ON ml.message_id = bm.id
        JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.kind = 'state' AND l.state_open
        JOIN LATERAL (
            SELECT tr.to_label_id, tl.name AS to_label
            FROM minerva.mail_label_transitions tr
            JOIN minerva.mail_labels tl ON tl.id = tr.to_label_id AND tl.kind = 'state' AND NOT tl.state_open
            WHERE tr.family_id = l.family_id AND tr.from_label_id = l.id
            ORDER BY tl.name
            LIMIT 1
        ) t ON true
        WHERE bm.account_id = c.account_id
          AND bm.id <> c.id
          AND (bm.from_address = c.from_address OR bm.from_domain = c.from_domain)
          AND bm.received_at < c.received_at
          AND bm.received_at >= c.received_at - interval '90 days'
          AND NOT EXISTS (
              SELECT 1 FROM minerva.mail_payment_dismissals d
              WHERE d.confirmation_id = c.id AND d.bill_id = bm.id
          )
        ORDER BY bm.received_at DESC, bm.gmail_id
        LIMIT 1
    ) b ON true
    WHERE NOT c.sent
      AND c.from_address IS NOT NULL
      AND minerva.mail_reads_as_payment(coalesce(c.subject, '') || ' ' || c.snippet);

DROP TABLE minerva.mail_payment_scores;
DROP TABLE minerva.mail_payment_acceptances;
