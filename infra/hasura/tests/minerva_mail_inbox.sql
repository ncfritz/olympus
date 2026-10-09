-- Checks for migration 1791330000000_minerva_mail_inbox. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_inbox.sql <database>

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
    ('9a9a0000-0000-4000-8000-000000000001', 'Inbox', 'inbox@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('9a9a0000-0000-4000-8000-0000000000a1', '9a9a0000-0000-4000-8000-000000000001', 'inbox@example.test', now(), 'import');
INSERT INTO minerva.mail_labels (id, account_id, name, type) VALUES
    ('9a9a0000-0000-4000-8000-0000000000c1', '9a9a0000-0000-4000-8000-0000000000a1', 'Travel', 'user'),
    ('9a9a0000-0000-4000-8000-0000000000c2', '9a9a0000-0000-4000-8000-0000000000a1', 'Bills', 'user');
-- m1, m2: one thread in the inbox; m3 archived; m4 archived, decided.
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at,
                                   snippet, size_bytes, in_inbox, unread) VALUES
    ('9a9a0000-0000-4000-8000-0000000000e1', '9a9a0000-0000-4000-8000-0000000000a1', 'e1', 'f1', 'gmail', now(), now(), '', 1, true, true),
    ('9a9a0000-0000-4000-8000-0000000000e2', '9a9a0000-0000-4000-8000-0000000000a1', 'e2', 'f1', 'gmail', now(), now(), '', 1, true, false),
    ('9a9a0000-0000-4000-8000-0000000000e3', '9a9a0000-0000-4000-8000-0000000000a1', 'e3', 'f3', 'gmail', now(), now(), '', 1, false, false),
    ('9a9a0000-0000-4000-8000-0000000000e4', '9a9a0000-0000-4000-8000-0000000000a1', 'e4', 'f4', 'gmail', now(), now(), '', 1, false, false);
INSERT INTO minerva.mail_message_labels (message_id, label_id) VALUES
    ('9a9a0000-0000-4000-8000-0000000000e2', '9a9a0000-0000-4000-8000-0000000000c1');
INSERT INTO minerva.mail_message_scores (account_id, gmail_id, model_run, feature_version) VALUES
    ('9a9a0000-0000-4000-8000-0000000000a1', 'e1', 'r1', 'v1'),
    ('9a9a0000-0000-4000-8000-0000000000a1', 'e2', 'r1', 'v1');
INSERT INTO minerva.mail_message_suggestions (account_id, gmail_id, label_id, rank, score, ticked) VALUES
    -- e1: Travel ticked, Bills not.
    ('9a9a0000-0000-4000-8000-0000000000a1', 'e1', '9a9a0000-0000-4000-8000-0000000000c1', 0, 0.950, true),
    ('9a9a0000-0000-4000-8000-0000000000a1', 'e1', '9a9a0000-0000-4000-8000-0000000000c2', 1, 0.990, false),
    -- e2: Travel ticked, but it has it already.
    ('9a9a0000-0000-4000-8000-0000000000a1', 'e2', '9a9a0000-0000-4000-8000-0000000000c1', 0, 0.970, true);
INSERT INTO minerva.mail_inbox_decisions (message_id, account_id, decision, model_run, amended, user_id) VALUES
    ('9a9a0000-0000-4000-8000-0000000000e4', '9a9a0000-0000-4000-8000-0000000000a1', 'approved', 'r1', true,
     '9a9a0000-0000-4000-8000-000000000001');

SELECT pg_temp.expect('the inbox and what was decided, not other mail',
    (SELECT array_agg(gmail_id ORDER BY gmail_id) = ARRAY['e1', 'e2', 'e4'] FROM minerva.mail_inbox
      WHERE account_id = '9a9a0000-0000-4000-8000-0000000000a1'));
SELECT pg_temp.expect('the best ticked label the message lacks',
    (SELECT top_score = 0.950 FROM minerva.mail_inbox WHERE gmail_id = 'e1'));
SELECT pg_temp.expect('nothing to add when it has the ticked label',
    (SELECT top_score IS NULL FROM minerva.mail_inbox WHERE gmail_id = 'e2'));
SELECT pg_temp.expect('a thread is counted',
    (SELECT thread_size = 2 FROM minerva.mail_inbox WHERE gmail_id = 'e1'));
SELECT pg_temp.expect('a decision shows',
    (SELECT decision = 'approved' AND amended FROM minerva.mail_inbox WHERE gmail_id = 'e4'));

SELECT pg_temp.expect_refused('a skip is neither written nor amended',
    $q$INSERT INTO minerva.mail_inbox_decisions (message_id, account_id, decision, amended, user_id)
       VALUES ('9a9a0000-0000-4000-8000-0000000000e1', '9a9a0000-0000-4000-8000-0000000000a1', 'skipped', true,
               '9a9a0000-0000-4000-8000-000000000001')$q$, '23514');
SELECT pg_temp.expect_refused('an unknown decision',
    $q$INSERT INTO minerva.mail_inbox_decisions (message_id, account_id, decision, user_id)
       VALUES ('9a9a0000-0000-4000-8000-0000000000e1', '9a9a0000-0000-4000-8000-0000000000a1', 'snoozed',
               '9a9a0000-0000-4000-8000-000000000001')$q$, '23514');

DELETE FROM minerva.mail_messages WHERE id = '9a9a0000-0000-4000-8000-0000000000e4';
SELECT pg_temp.expect('a decision goes with its message',
    (SELECT count(*) = 0 FROM minerva.mail_inbox_decisions
      WHERE message_id = '9a9a0000-0000-4000-8000-0000000000e4'));

ROLLBACK;
