-- Checks for migration 1791380000000_minerva_mail_payment_learning. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_payment_learning.sql <database>

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


INSERT INTO olympus.users (id, display_name, email) VALUES
    ('5d5d0000-0000-4000-8000-000000000001', 'Learning', 'learning@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('5d5d0000-0000-4000-8000-0000000000a1', '5d5d0000-0000-4000-8000-000000000001', 'learning@example.test', now(), 'import');
INSERT INTO minerva.mail_label_families (id, account_id, name) VALUES
    ('5d5d0000-0000-4000-8000-0000000000f1', '5d5d0000-0000-4000-8000-0000000000a1', 'Bills');
INSERT INTO minerva.mail_labels (id, account_id, name, type, kind, family_id, state_open) VALUES
    ('5d5d0000-0000-4000-8000-0000000000c1', '5d5d0000-0000-4000-8000-0000000000a1', 'Bills/*Payable', 'user', 'state', '5d5d0000-0000-4000-8000-0000000000f1', true),
    ('5d5d0000-0000-4000-8000-0000000000c2', '5d5d0000-0000-4000-8000-0000000000a1', 'Bills/*Paid', 'user', 'state', '5d5d0000-0000-4000-8000-0000000000f1', false);
INSERT INTO minerva.mail_label_transitions (family_id, from_label_id, to_label_id) VALUES
    ('5d5d0000-0000-4000-8000-0000000000f1', '5d5d0000-0000-4000-8000-0000000000c1', '5d5d0000-0000-4000-8000-0000000000c2');

-- b1 a bill; d1 "Your autopay went through" (no wording the rules know),
-- scored 0.93; d2 another bill, scored 0.95 but itself in an open state;
-- d3 scored 0.6, too low.
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at,
                                   from_address, subject, snippet, size_bytes) VALUES
    ('5d5d0000-0000-4000-8000-0000000000b1', '5d5d0000-0000-4000-8000-0000000000a1', 'b1', 'b1', 'gmail', now(), now() - interval '10 days', 'billing@power.example', 'Your bill', '', 1),
    ('5d5d0000-0000-4000-8000-0000000000d1', '5d5d0000-0000-4000-8000-0000000000a1', 'd1', 'd1', 'gmail', now(), now() - interval '2 days', 'billing@power.example', 'Your autopay went through', '', 1),
    ('5d5d0000-0000-4000-8000-0000000000d2', '5d5d0000-0000-4000-8000-0000000000a1', 'd2', 'd2', 'gmail', now(), now() - interval '1 days', 'billing@power.example', 'Another bill', '', 1),
    ('5d5d0000-0000-4000-8000-0000000000d3', '5d5d0000-0000-4000-8000-0000000000a1', 'd3', 'd3', 'gmail', now(), now() - interval '1 days', 'billing@power.example', 'Rate change', '', 1);
INSERT INTO minerva.mail_message_labels (message_id, label_id) VALUES
    ('5d5d0000-0000-4000-8000-0000000000b1', '5d5d0000-0000-4000-8000-0000000000c1'),
    ('5d5d0000-0000-4000-8000-0000000000d2', '5d5d0000-0000-4000-8000-0000000000c1');
INSERT INTO minerva.mail_payment_scores (account_id, gmail_id, score) VALUES
    ('5d5d0000-0000-4000-8000-0000000000a1', 'd1', 0.93),
    ('5d5d0000-0000-4000-8000-0000000000a1', 'd2', 0.95),
    ('5d5d0000-0000-4000-8000-0000000000a1', 'd3', 0.6);

SELECT pg_temp.expect('a learned confirmation is matched, a bill or a weak score is not',
    (SELECT array_agg(confirmation_gmail_id || '>' || bill_gmail_id || ':' || matched_by ORDER BY confirmation_gmail_id)
       FROM minerva.mail_payment_matches
      WHERE account_id = '5d5d0000-0000-4000-8000-0000000000a1')
    = ARRAY['d1>b1:learned']);

SELECT pg_temp.expect_refused('a score past 1',
    $q$INSERT INTO minerva.mail_payment_scores (account_id, gmail_id, score)
       VALUES ('5d5d0000-0000-4000-8000-0000000000a1', 'e9', 1.5)$q$, '23514');

INSERT INTO minerva.mail_payment_acceptances (confirmation_id, bill_id, user_id) VALUES
    ('5d5d0000-0000-4000-8000-0000000000d1', '5d5d0000-0000-4000-8000-0000000000b1', '5d5d0000-0000-4000-8000-000000000001');
SELECT pg_temp.expect('an acceptance is kept',
    (SELECT count(*) = 1 FROM minerva.mail_payment_acceptances
      WHERE confirmation_id = '5d5d0000-0000-4000-8000-0000000000d1'));

ROLLBACK;
