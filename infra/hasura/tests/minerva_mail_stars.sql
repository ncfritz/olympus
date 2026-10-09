-- Checks for migration 1791350000000_minerva_mail_stars. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_stars.sql <database>

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
    ('5a5a0000-0000-4000-8000-000000000001', 'Stars', 'stars@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('5a5a0000-0000-4000-8000-0000000000a1', '5a5a0000-0000-4000-8000-000000000001', 'stars@example.test', now(), 'import');

SELECT pg_temp.expect('the default stars',
    (SELECT attention_star = 'red-bang' AND done_star = 'green-check'
       FROM minerva.mail_accounts WHERE id = '5a5a0000-0000-4000-8000-0000000000a1'));
SELECT pg_temp.expect_refused('the same star for both',
    $q$UPDATE minerva.mail_accounts SET done_star = 'red-bang'
       WHERE id = '5a5a0000-0000-4000-8000-0000000000a1'$q$, '23514');
SELECT pg_temp.expect_refused('an icon Gmail has not',
    $q$UPDATE minerva.mail_accounts SET attention_star = 'pink-heart'
       WHERE id = '5a5a0000-0000-4000-8000-0000000000a1'$q$, '23514');

INSERT INTO minerva.mail_label_families (id, account_id, name) VALUES
    ('5a5a0000-0000-4000-8000-0000000000f1', '5a5a0000-0000-4000-8000-0000000000a1', 'Bills');
INSERT INTO minerva.mail_labels (id, account_id, name, type, kind, family_id, state_open) VALUES
    ('5a5a0000-0000-4000-8000-0000000000c1', '5a5a0000-0000-4000-8000-0000000000a1', 'Bills/*Payable', 'user', 'state', '5a5a0000-0000-4000-8000-0000000000f1', true),
    ('5a5a0000-0000-4000-8000-0000000000c2', '5a5a0000-0000-4000-8000-0000000000a1', 'Bills/*Paid', 'user', 'state', '5a5a0000-0000-4000-8000-0000000000f1', false);
INSERT INTO minerva.mail_labels (id, account_id, name, type) VALUES
    ('5a5a0000-0000-4000-8000-0000000000c3', '5a5a0000-0000-4000-8000-0000000000a1', 'Travel', 'user');
-- e1 payable, unstarred: star. e2 payable, yellow star: attention icon.
-- e3 payable, red bang: fine. e4 paid, red bang: done icon. e5 paid,
-- green check: fine. e6 payable, starred, icon unknown: left alone.
-- e7 Travel, unstarred: not a state.
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at,
                                   snippet, size_bytes, starred, star_icon) VALUES
    ('5a5a0000-0000-4000-8000-0000000000e1', '5a5a0000-0000-4000-8000-0000000000a1', 'e1', 'e1', 'gmail', now(), now(), '', 1, false, NULL),
    ('5a5a0000-0000-4000-8000-0000000000e2', '5a5a0000-0000-4000-8000-0000000000a1', 'e2', 'e2', 'gmail', now(), now(), '', 1, true, 'yellow-star'),
    ('5a5a0000-0000-4000-8000-0000000000e3', '5a5a0000-0000-4000-8000-0000000000a1', 'e3', 'e3', 'gmail', now(), now(), '', 1, true, 'red-bang'),
    ('5a5a0000-0000-4000-8000-0000000000e4', '5a5a0000-0000-4000-8000-0000000000a1', 'e4', 'e4', 'gmail', now(), now(), '', 1, true, 'red-bang'),
    ('5a5a0000-0000-4000-8000-0000000000e5', '5a5a0000-0000-4000-8000-0000000000a1', 'e5', 'e5', 'gmail', now(), now(), '', 1, true, 'green-check'),
    ('5a5a0000-0000-4000-8000-0000000000e6', '5a5a0000-0000-4000-8000-0000000000a1', 'e6', 'e6', 'gmail', now(), now(), '', 1, true, NULL),
    ('5a5a0000-0000-4000-8000-0000000000e7', '5a5a0000-0000-4000-8000-0000000000a1', 'e7', 'e7', 'gmail', now(), now(), '', 1, false, NULL);
INSERT INTO minerva.mail_message_labels (message_id, label_id) VALUES
    ('5a5a0000-0000-4000-8000-0000000000e1', '5a5a0000-0000-4000-8000-0000000000c1'),
    ('5a5a0000-0000-4000-8000-0000000000e2', '5a5a0000-0000-4000-8000-0000000000c1'),
    ('5a5a0000-0000-4000-8000-0000000000e3', '5a5a0000-0000-4000-8000-0000000000c1'),
    ('5a5a0000-0000-4000-8000-0000000000e4', '5a5a0000-0000-4000-8000-0000000000c2'),
    ('5a5a0000-0000-4000-8000-0000000000e5', '5a5a0000-0000-4000-8000-0000000000c2'),
    ('5a5a0000-0000-4000-8000-0000000000e6', '5a5a0000-0000-4000-8000-0000000000c1'),
    ('5a5a0000-0000-4000-8000-0000000000e7', '5a5a0000-0000-4000-8000-0000000000c3');

SELECT pg_temp.expect('the mismatches and their fixes',
    (SELECT array_agg(gmail_id || ':' || fix ORDER BY gmail_id)
       FROM minerva.mail_star_mismatches
      WHERE account_id = '5a5a0000-0000-4000-8000-0000000000a1')
    = ARRAY['e1:star', 'e2:attention-icon', 'e4:done-icon']);

ROLLBACK;
