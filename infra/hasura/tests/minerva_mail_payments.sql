-- Checks for migration 1791360000000_minerva_mail_payments. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_payments.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS NOT TRUE THEN RAISE EXCEPTION '%: wrong', label; END IF;
END $$;
CREATE FUNCTION pg_temp.expect_refused(label text, statement text, code text)
    RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE statement;
    RAISE EXCEPTION '%: not refused', label;
EXCEPTION
    WHEN OTHERS THEN
        IF SQLSTATE = 'P0001' OR SQLSTATE <> code THEN
            RAISE EXCEPTION '%: expected %, got % (%)', label, code, SQLSTATE, SQLERRM;
        END IF;
END $$;


SELECT pg_temp.expect('payment wording',
    minerva.mail_reads_as_payment('Thank you for your payment')
    AND minerva.mail_reads_as_payment('Payment received - account ending 1234')
    AND minerva.mail_reads_as_payment('Your bill has been paid')
    AND minerva.mail_reads_as_payment('AutoPay payment processed')
    AND NOT minerva.mail_reads_as_payment('Your payment is due Oct 12')
    AND NOT minerva.mail_reads_as_payment('Payment scheduled for Oct 12')
    AND NOT minerva.mail_reads_as_payment('Your bill is ready'));

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('5b5b0000-0000-4000-8000-000000000001', 'Payments', 'payments@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('5b5b0000-0000-4000-8000-0000000000a1', '5b5b0000-0000-4000-8000-000000000001', 'payments@example.test', now(), 'import');
INSERT INTO minerva.mail_label_families (id, account_id, name) VALUES
    ('5b5b0000-0000-4000-8000-0000000000f1', '5b5b0000-0000-4000-8000-0000000000a1', 'Bills');
INSERT INTO minerva.mail_labels (id, account_id, name, type, kind, family_id, state_open) VALUES
    ('5b5b0000-0000-4000-8000-0000000000c1', '5b5b0000-0000-4000-8000-0000000000a1', 'Bills/*Payable', 'user', 'state', '5b5b0000-0000-4000-8000-0000000000f1', true),
    ('5b5b0000-0000-4000-8000-0000000000c2', '5b5b0000-0000-4000-8000-0000000000a1', 'Bills/*Paid', 'user', 'state', '5b5b0000-0000-4000-8000-0000000000f1', false);
INSERT INTO minerva.mail_label_transitions (family_id, from_label_id, to_label_id) VALUES
    ('5b5b0000-0000-4000-8000-0000000000f1', '5b5b0000-0000-4000-8000-0000000000c1', '5b5b0000-0000-4000-8000-0000000000c2');

-- Power: an old bill (b0), a newer one (b1), and their payment (d1).
-- Water: a bill (b2) and a payment (d2) from another address at the same
-- domain. Gas: a payment with no open bill (d3). A reminder (e1) is not a
-- payment. A payment (d4) 100 days after its bill (b3) is too late.
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at,
                                   from_address, subject, snippet, size_bytes, starred) VALUES
    ('5b5b0000-0000-4000-8000-0000000000b0', '5b5b0000-0000-4000-8000-0000000000a1', 'b0', 'b0', 'gmail', now(), now() - interval '40 days', 'billing@power.example', 'Your bill', '', 1, false),
    ('5b5b0000-0000-4000-8000-0000000000b1', '5b5b0000-0000-4000-8000-0000000000a1', 'b1', 'b1', 'gmail', now(), now() - interval '10 days', 'billing@power.example', 'Your bill', '', 1, true),
    ('5b5b0000-0000-4000-8000-0000000000d1', '5b5b0000-0000-4000-8000-0000000000a1', 'd1', 'd1', 'gmail', now(), now() - interval '2 days', 'billing@power.example', 'Thank you for your payment', '', 1, false),
    ('5b5b0000-0000-4000-8000-0000000000b2', '5b5b0000-0000-4000-8000-0000000000a1', 'b2', 'b2', 'gmail', now(), now() - interval '20 days', 'bills@water.example', 'Statement', '', 1, false),
    ('5b5b0000-0000-4000-8000-0000000000d2', '5b5b0000-0000-4000-8000-0000000000a1', 'd2', 'd2', 'gmail', now(), now() - interval '1 days', 'noreply@water.example', 'Receipt', 'We have received your payment of $40', 1, false),
    ('5b5b0000-0000-4000-8000-0000000000d3', '5b5b0000-0000-4000-8000-0000000000a1', 'd3', 'd3', 'gmail', now(), now() - interval '1 days', 'billing@gas.example', 'Payment received', '', 1, false),
    ('5b5b0000-0000-4000-8000-0000000000e1', '5b5b0000-0000-4000-8000-0000000000a1', 'e1', 'e1', 'gmail', now(), now() - interval '1 days', 'billing@power.example', 'Your payment is due soon', '', 1, false),
    ('5b5b0000-0000-4000-8000-0000000000b3', '5b5b0000-0000-4000-8000-0000000000a1', 'b3', 'b3', 'gmail', now(), now() - interval '200 days', 'billing@phone.example', 'Your bill', '', 1, false),
    ('5b5b0000-0000-4000-8000-0000000000d4', '5b5b0000-0000-4000-8000-0000000000a1', 'd4', 'd4', 'gmail', now(), now() - interval '100 days', 'billing@phone.example', 'Payment received', '', 1, false);
INSERT INTO minerva.mail_message_labels (message_id, label_id) VALUES
    ('5b5b0000-0000-4000-8000-0000000000b0', '5b5b0000-0000-4000-8000-0000000000c1'),
    ('5b5b0000-0000-4000-8000-0000000000b1', '5b5b0000-0000-4000-8000-0000000000c1'),
    ('5b5b0000-0000-4000-8000-0000000000b2', '5b5b0000-0000-4000-8000-0000000000c1'),
    ('5b5b0000-0000-4000-8000-0000000000b3', '5b5b0000-0000-4000-8000-0000000000c1');

SELECT pg_temp.expect('each payment pairs with the newest open bill',
    (SELECT array_agg(confirmation_gmail_id || '>' || bill_gmail_id || ':' || from_label || '>' || to_label
                      ORDER BY confirmation_gmail_id)
       FROM minerva.mail_payment_matches
      WHERE account_id = '5b5b0000-0000-4000-8000-0000000000a1')
    = ARRAY['d1>b1:Bills/*Payable>Bills/*Paid', 'd2>b2:Bills/*Payable>Bills/*Paid']);
SELECT pg_temp.expect('the bill''s star comes along',
    (SELECT bill_starred FROM minerva.mail_payment_matches WHERE confirmation_gmail_id = 'd1'));

SELECT pg_temp.expect('the open states, each with where it moves',
    (SELECT array_agg(gmail_id || ':' || to_label ORDER BY gmail_id)
       FROM minerva.mail_open_states
      WHERE account_id = '5b5b0000-0000-4000-8000-0000000000a1')
    = ARRAY['b0:Bills/*Paid', 'b1:Bills/*Paid', 'b2:Bills/*Paid', 'b3:Bills/*Paid']);
SELECT pg_temp.expect('whether the confirmation is in the inbox',
    (SELECT NOT confirmation_in_inbox FROM minerva.mail_payment_matches WHERE confirmation_gmail_id = 'd1'));

-- Declining d1's pair with b1 offers the bill before it.
INSERT INTO minerva.mail_payment_dismissals (confirmation_id, bill_id) VALUES
    ('5b5b0000-0000-4000-8000-0000000000d1', '5b5b0000-0000-4000-8000-0000000000b1');
SELECT pg_temp.expect('a declined pair gives way to the bill before',
    (SELECT bill_gmail_id FROM minerva.mail_payment_matches WHERE confirmation_gmail_id = 'd1') = 'b0');

-- Once paid, the bill is no longer offered.
UPDATE minerva.mail_message_labels SET label_id = '5b5b0000-0000-4000-8000-0000000000c2'
 WHERE message_id = '5b5b0000-0000-4000-8000-0000000000b2';
SELECT pg_temp.expect('a paid bill is not offered',
    NOT EXISTS (SELECT 1 FROM minerva.mail_payment_matches WHERE confirmation_gmail_id = 'd2'));

ROLLBACK;
