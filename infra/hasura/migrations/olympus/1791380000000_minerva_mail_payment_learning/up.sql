-- Learned payment confirmations (ADR 0030; docs/plans/email-management
-- phase 7 step 3). A payment match approved is recorded; with those
-- declined and the bills themselves, the classifier learns what a payment
-- reads like and scores the mailbox each night. A message scored 0.8 or
-- more is a confirmation too, matched as one the wording found; the
-- wording stays the reason where it reads.

-- A match approved: the bill moved, with the batch that moved it.
CREATE TABLE minerva.mail_payment_acceptances (
    confirmation_id uuid NOT NULL,
    bill_id uuid NOT NULL,
    batch_id uuid,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY minerva.mail_payment_acceptances
    ADD CONSTRAINT mail_payment_acceptances_pkey PRIMARY KEY (confirmation_id, bill_id);
ALTER TABLE ONLY minerva.mail_payment_acceptances
    ADD CONSTRAINT mail_payment_acceptances_confirmation_id_fkey FOREIGN KEY (confirmation_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_payment_acceptances
    ADD CONSTRAINT mail_payment_acceptances_bill_id_fkey FOREIGN KEY (bill_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_payment_acceptances
    ADD CONSTRAINT mail_payment_acceptances_batch_id_fkey FOREIGN KEY (batch_id)
    REFERENCES minerva.mail_change_batches(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY minerva.mail_payment_acceptances
    ADD CONSTRAINT mail_payment_acceptances_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_payment_acceptances_bill_id_idx ON minerva.mail_payment_acceptances USING btree (bill_id);
CREATE TRIGGER set_minerva_mail_payment_acceptances_updated_at BEFORE UPDATE ON minerva.mail_payment_acceptances
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- The classifier's payment scores, the confident ones only, replaced
-- each night.
CREATE TABLE minerva.mail_payment_scores (
    account_id uuid NOT NULL,
    gmail_id text NOT NULL,
    score numeric(4, 3) NOT NULL,
    scored_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_payment_scores_score_check CHECK (score BETWEEN 0 AND 1)
);
ALTER TABLE ONLY minerva.mail_payment_scores
    ADD CONSTRAINT mail_payment_scores_pkey PRIMARY KEY (account_id, gmail_id);
ALTER TABLE ONLY minerva.mail_payment_scores
    ADD CONSTRAINT mail_payment_scores_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_payment_scores_updated_at BEFORE UPDATE ON minerva.mail_payment_scores
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

CREATE OR REPLACE VIEW minerva.mail_payment_matches AS
    SELECT c.id AS confirmation_id, c.account_id, c.gmail_id AS confirmation_gmail_id,
           c.received_at AS confirmed_at, c.in_inbox AS confirmation_in_inbox,
           b.id AS bill_id, b.gmail_id AS bill_gmail_id, b.received_at AS bill_received_at,
           b.from_label_id, b.from_label, b.to_label_id, b.to_label, b.starred AS bill_starred,
           CASE WHEN minerva.mail_reads_as_payment(coalesce(c.subject, '') || ' ' || c.snippet)
                THEN 'wording' ELSE 'learned' END AS matched_by
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
      AND (
          minerva.mail_reads_as_payment(coalesce(c.subject, '') || ' ' || c.snippet)
          -- The learned score, for what the wording misses; a message in
          -- an open state itself is a bill, not its payment.
          OR (
              EXISTS (
                  SELECT 1 FROM minerva.mail_payment_scores ps
                  WHERE ps.account_id = c.account_id AND ps.gmail_id = c.gmail_id
                    AND ps.score >= 0.8
              )
              AND NOT EXISTS (
                  SELECT 1 FROM minerva.mail_message_labels cl
                  JOIN minerva.mail_labels l ON l.id = cl.label_id AND l.kind = 'state' AND l.state_open
                  WHERE cl.message_id = c.id
              )
          )
      );

