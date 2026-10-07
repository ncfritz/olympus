-- Checks for migration 1791320000000_minerva_mail_message_suggestions. Runs
-- in a transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_message_suggestions.sql <database>

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
    ('8f8f0000-0000-4000-8000-000000000001', 'Scores', 'scores@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('8f8f0000-0000-4000-8000-0000000000a1', '8f8f0000-0000-4000-8000-000000000001', 'scores@example.test', now(), 'import');
INSERT INTO minerva.mail_labels (id, account_id, name, type) VALUES
    ('8f8f0000-0000-4000-8000-0000000000c1', '8f8f0000-0000-4000-8000-0000000000a1', 'Travel', 'user'),
    ('8f8f0000-0000-4000-8000-0000000000c2', '8f8f0000-0000-4000-8000-0000000000a1', 'Bills/*Payable', 'user');

-- A message is scored before it is stored: no message row is needed.
INSERT INTO minerva.mail_message_scores (account_id, gmail_id, model_run, feature_version) VALUES
    ('8f8f0000-0000-4000-8000-0000000000a1', '18f0a1', '6ca3f45f', 'v1'),
    ('8f8f0000-0000-4000-8000-0000000000a1', '18f0a2', '6ca3f45f', 'v1');
INSERT INTO minerva.mail_message_suggestions (account_id, gmail_id, label_id, rank, score, ticked) VALUES
    ('8f8f0000-0000-4000-8000-0000000000a1', '18f0a1', '8f8f0000-0000-4000-8000-0000000000c1', 0, 0.962, true),
    ('8f8f0000-0000-4000-8000-0000000000a1', '18f0a1', '8f8f0000-0000-4000-8000-0000000000c2', 1, 0.130, false);

SELECT pg_temp.expect('a message holds its suggestions',
    (SELECT count(*) = 2 FROM minerva.mail_message_suggestions WHERE gmail_id = '18f0a1'));
SELECT pg_temp.expect_refused('a suggestion needs its message scored',
    $q$INSERT INTO minerva.mail_message_suggestions (account_id, gmail_id, label_id, rank, score, ticked)
       VALUES ('8f8f0000-0000-4000-8000-0000000000a1', '18f0a9', '8f8f0000-0000-4000-8000-0000000000c1', 0, 0.5, true)$q$, '23503');
SELECT pg_temp.expect_refused('a label once per message',
    $q$INSERT INTO minerva.mail_message_suggestions (account_id, gmail_id, label_id, rank, score, ticked)
       VALUES ('8f8f0000-0000-4000-8000-0000000000a1', '18f0a1', '8f8f0000-0000-4000-8000-0000000000c1', 2, 0.5, true)$q$, '23505');
SELECT pg_temp.expect_refused('a score is from 0 to 1',
    $q$INSERT INTO minerva.mail_message_suggestions (account_id, gmail_id, label_id, rank, score, ticked)
       VALUES ('8f8f0000-0000-4000-8000-0000000000a1', '18f0a2', '8f8f0000-0000-4000-8000-0000000000c1', 0, 1.5, true)$q$, '23514');
SELECT pg_temp.expect_refused('a Gmail ID is hexadecimal',
    $q$INSERT INTO minerva.mail_message_scores (account_id, gmail_id, model_run, feature_version)
       VALUES ('8f8f0000-0000-4000-8000-0000000000a1', 'not-hex', 'r', 'v1')$q$, '23514');

DELETE FROM minerva.mail_labels WHERE id = '8f8f0000-0000-4000-8000-0000000000c2';
SELECT pg_temp.expect('a deleted label leaves its suggestions',
    (SELECT count(*) = 1 FROM minerva.mail_message_suggestions WHERE gmail_id = '18f0a1'));
DELETE FROM minerva.mail_message_scores WHERE gmail_id = '18f0a1';
SELECT pg_temp.expect('suggestions go with their score',
    (SELECT count(*) = 0 FROM minerva.mail_message_suggestions WHERE gmail_id = '18f0a1'));
DELETE FROM minerva.mail_accounts WHERE id = '8f8f0000-0000-4000-8000-0000000000a1';
SELECT pg_temp.expect('scores go with their account',
    (SELECT count(*) = 0 FROM minerva.mail_message_scores
      WHERE account_id = '8f8f0000-0000-4000-8000-0000000000a1'));

ROLLBACK;
