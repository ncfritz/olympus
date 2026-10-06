-- Checks for migration 1791300000000_minerva_mail_processed. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_processed.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS NOT TRUE THEN RAISE EXCEPTION '%: wrong', label; END IF;
END $$;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('7d7d0000-0000-4000-8000-000000000001', 'Processed', 'processed@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('7d7d0000-0000-4000-8000-0000000000a1', '7d7d0000-0000-4000-8000-000000000001', 'processed@example.test', now(), 'import');
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes) VALUES
    ('7d7d0000-0000-4000-8000-0000000000b1', '7d7d0000-0000-4000-8000-0000000000a1', 'b1', 'b1', 'gmail', now(), now(), '', 1),
    ('7d7d0000-0000-4000-8000-0000000000b2', '7d7d0000-0000-4000-8000-0000000000a1', 'b2', 'b2', 'gmail', now(), now(), '', 1);
INSERT INTO minerva.mail_labels (id, account_id, name) VALUES
    ('7d7d0000-0000-4000-8000-0000000000c1', '7d7d0000-0000-4000-8000-0000000000a1', 'Travel');
INSERT INTO minerva.mail_audit_runs (id, account_id, started_at, finished_at, messages_examined, senders_examined, consistent_senders)
    VALUES ('7d7d0000-0000-4000-8000-0000000000e1', '7d7d0000-0000-4000-8000-0000000000a1', now(), now(), 2, 1, 1);
INSERT INTO minerva.mail_suggestion_runs (id, account_id, model_run, feature_version, status, finished_at, messages_scored) VALUES
    ('7d7d0000-0000-4000-8000-0000000000d1', '7d7d0000-0000-4000-8000-0000000000a1', 'run-1', 'v1', 'ready', now(), 2);
INSERT INTO minerva.mail_suggestions (run_id, message_id, label_id, action, confidence, ticked) VALUES
    ('7d7d0000-0000-4000-8000-0000000000d1', '7d7d0000-0000-4000-8000-0000000000b1', '7d7d0000-0000-4000-8000-0000000000c1', 'add', 0.95, true),
    ('7d7d0000-0000-4000-8000-0000000000d1', '7d7d0000-0000-4000-8000-0000000000b2', '7d7d0000-0000-4000-8000-0000000000c1', 'add', 0.85, true);
INSERT INTO minerva.mail_decisions (account_id, message_id, label_id, action, decision, user_id) VALUES
    ('7d7d0000-0000-4000-8000-0000000000a1', '7d7d0000-0000-4000-8000-0000000000b1', '7d7d0000-0000-4000-8000-0000000000c1',
     'add', 'dismissed', '7d7d0000-0000-4000-8000-000000000001');

SELECT pg_temp.expect('the label tree counts what was decided',
    (SELECT proposed_in = 2 AND processed = 1
       FROM minerva.mail_audit_labels('7d7d0000-0000-4000-8000-000000000001', 0.9) WHERE name = 'Travel'));
SELECT pg_temp.expect('and so does the summary',
    (SELECT changes = 2 AND processed = 1
       FROM minerva.mail_audit_summary('7d7d0000-0000-4000-8000-000000000001', 0.9)));

ROLLBACK;
