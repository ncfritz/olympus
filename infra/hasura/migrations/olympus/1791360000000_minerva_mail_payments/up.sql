-- Transitions from payments (ADR 0030; docs/plans/email-management phase 7
-- step 2). A payment confirmation is a message whose subject or snippet
-- reads as a payment made; it pairs with the newest message before it, in
-- the 90 days before, from the same sender or the sender's domain, in an
-- open state that has a transition to a closed one (`Bills/*Payable` to
-- `Bills/*Paid`). The pair suggests moving the bill along the transition.
-- Nothing is stored but a pair declined.

-- Whether text reads as a payment made (not one due or scheduled).
CREATE FUNCTION minerva.mail_reads_as_payment(text) RETURNS boolean
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT $1 ~* (
        'payment (has been |was )?(received|confirmed|processed|posted|completed?|successful)'
        || '|payment confirmation|confirmation of (your )?payment'
        || '|thanks? (you )?for (your|the) (recent )?payment'
        || '|(we|we''ve|we have) received your payment'
        || '|(has|have) been paid|was paid|paid in full'
        || '|receipt for (your )?payment|payment receipt'
        || '|autopay (payment )?(processed|successful|complete)'
    )
$$;

-- A pair declined: the confirmation is not that bill's payment.
CREATE TABLE minerva.mail_payment_dismissals (
    confirmation_id uuid NOT NULL,
    bill_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY minerva.mail_payment_dismissals
    ADD CONSTRAINT mail_payment_dismissals_pkey PRIMARY KEY (confirmation_id, bill_id);
ALTER TABLE ONLY minerva.mail_payment_dismissals
    ADD CONSTRAINT mail_payment_dismissals_confirmation_id_fkey FOREIGN KEY (confirmation_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_payment_dismissals
    ADD CONSTRAINT mail_payment_dismissals_bill_id_fkey FOREIGN KEY (bill_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_payment_dismissals_bill_id_idx ON minerva.mail_payment_dismissals USING btree (bill_id);
CREATE TRIGGER set_minerva_mail_payment_dismissals_updated_at BEFORE UPDATE ON minerva.mail_payment_dismissals
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Messages in an open state, with the closed state its transition leads
-- to (none when the family has no transition from it): the open bills.
CREATE VIEW minerva.mail_open_states AS
    SELECT m.id AS message_id, m.account_id, m.gmail_id, m.received_at, m.starred, m.star_icon,
           l.id AS label_id, l.name AS label, l.family_id,
           t.to_label_id, t.to_label
    FROM minerva.mail_messages m
    JOIN minerva.mail_message_labels ml ON ml.message_id = m.id
    JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.kind = 'state' AND l.state_open
    LEFT JOIN LATERAL (
        SELECT tr.to_label_id, tl.name AS to_label
        FROM minerva.mail_label_transitions tr
        JOIN minerva.mail_labels tl ON tl.id = tr.to_label_id AND tl.kind = 'state' AND NOT tl.state_open
        WHERE tr.family_id = l.family_id AND tr.from_label_id = l.id
        ORDER BY tl.name
        LIMIT 1
    ) t ON true;

-- Each confirmation with the bill it pays and the move it suggests.
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
