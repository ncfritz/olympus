-- Checks for migration 1791250000000_minerva_mail_suggestions. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_suggestions.sql <database>

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
    ('5a660000-0000-4000-8000-000000000001', 'Suggest A', 'suggest-a@example.test'),
    ('5a660000-0000-4000-8000-000000000002', 'Suggest B', 'suggest-b@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('5a660000-0000-4000-8000-0000000000a1', '5a660000-0000-4000-8000-000000000001', 'suggest-a@example.test', now(), 'import'),
    ('5a660000-0000-4000-8000-0000000000b1', '5a660000-0000-4000-8000-000000000002', 'suggest-b@example.test', now(), 'import');
INSERT INTO minerva.mail_labels (id, account_id, gmail_label_id, name, type) VALUES
    ('5a660000-0000-4000-8000-0000000000c1', '5a660000-0000-4000-8000-0000000000a1', 'Label_1', 'Bills', 'user'),
    ('5a660000-0000-4000-8000-0000000000c2', '5a660000-0000-4000-8000-0000000000a1', 'Label_2', 'Travel', 'user');

-- Six messages from one sender, five labelled Bills: the audit proposes
-- Bills for the sixth.
INSERT INTO minerva.mail_messages
    (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at, from_address, snippet, size_bytes)
SELECT ('5a660000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid,
       '5a660000-0000-4000-8000-0000000000a1', to_hex(4096 + i), to_hex(4096 + i), 'takeout', now(),
       timestamptz '2025-01-01' + i * interval '1 day', 'bills@power.example', '', 1
FROM generate_series(1, 6) i;
INSERT INTO minerva.mail_message_labels (message_id, label_id)
SELECT ('5a660000-0000-4000-8000-0000000001' || lpad(i::text, 2, '0'))::uuid, '5a660000-0000-4000-8000-0000000000c1'
FROM generate_series(1, 5) i;
SELECT count(*) FROM minerva.mail_run_audit('5a660000-0000-4000-8000-000000000001');

SELECT pg_temp.expect('the audit proposes Bills for the sixth',
    (SELECT count(*) = 1 FROM minerva.mail_proposals
      WHERE rule = 'sender' AND account_id = '5a660000-0000-4000-8000-0000000000a1'));

-- A classifier run, still building: not proposed yet.
INSERT INTO minerva.mail_suggestion_runs (id, account_id, model_run, feature_version) VALUES
    ('5a660000-0000-4000-8000-0000000002a1', '5a660000-0000-4000-8000-0000000000a1', 'run-1', 'v1');
INSERT INTO minerva.mail_suggestions (run_id, message_id, label_id, action, confidence, ticked) VALUES
    ('5a660000-0000-4000-8000-0000000002a1', '5a660000-0000-4000-8000-000000000106', '5a660000-0000-4000-8000-0000000000c1', 'add', 0.97, true),
    ('5a660000-0000-4000-8000-0000000002a1', '5a660000-0000-4000-8000-000000000101', '5a660000-0000-4000-8000-0000000000c1', 'remove', 0.62, false),
    ('5a660000-0000-4000-8000-0000000002a1', '5a660000-0000-4000-8000-000000000102', '5a660000-0000-4000-8000-0000000000c2', 'add', 0.95, true);
SELECT pg_temp.expect('a building run proposes nothing',
    (SELECT count(*) = 0 FROM minerva.mail_proposals WHERE rule = 'classifier'));

-- Published.
UPDATE minerva.mail_suggestion_runs SET status = 'ready', finished_at = now(), messages_scored = 6
WHERE id = '5a660000-0000-4000-8000-0000000002a1';
SELECT pg_temp.expect('a ready run proposes its suggestions',
    (SELECT count(*) = 3 FROM minerva.mail_proposals WHERE rule = 'classifier'));
SELECT pg_temp.expect('with whether each is ticked, and no sender counts',
    (SELECT bool_and(ticked IS NOT NULL AND sender_messages IS NULL)
       FROM minerva.mail_proposals WHERE rule = 'classifier'));

SELECT pg_temp.expect('the summary counts both rules',
    (SELECT changes = 4 AND additions = 3 AND removals = 1 AND high_confidence = 2
            AND classifier_changes = 3 AND classifier_finished_at IS NOT NULL
            AND messages_affected = 3
       FROM minerva.mail_audit_summary('5a660000-0000-4000-8000-000000000001', 0.95)));
SELECT pg_temp.expect('the label tree counts both rules',
    (SELECT proposed_in = 2 AND proposed_out = 1
       FROM minerva.mail_audit_labels('5a660000-0000-4000-8000-000000000001', 0.9)
      WHERE name = 'Bills'));
SELECT pg_temp.expect('and the classifier alone for a label the audit did not touch',
    (SELECT proposed_in = 1 AND proposed_out = 0 AND high_confidence = 1
       FROM minerva.mail_audit_labels('5a660000-0000-4000-8000-000000000001', 0.9)
      WHERE name = 'Travel'));
SELECT pg_temp.expect('nothing of it is another user''s',
    (SELECT count(*) = 0 FROM minerva.mail_proposals
      WHERE account_id = '5a660000-0000-4000-8000-0000000000b1'));

SELECT pg_temp.expect_refused('a ready run needs its finish and count',
    $q$UPDATE minerva.mail_suggestion_runs SET finished_at = NULL
       WHERE id = '5a660000-0000-4000-8000-0000000002a1'$q$, '23514');
SELECT pg_temp.expect_refused('an action is add or remove',
    $q$INSERT INTO minerva.mail_suggestions (run_id, message_id, label_id, action, confidence, ticked)
       VALUES ('5a660000-0000-4000-8000-0000000002a1', '5a660000-0000-4000-8000-000000000103',
               '5a660000-0000-4000-8000-0000000000c2', 'move', 0.9, true)$q$, '23514');
SELECT pg_temp.expect_refused('a confidence is 0 to 1',
    $q$INSERT INTO minerva.mail_suggestions (run_id, message_id, label_id, action, confidence, ticked)
       VALUES ('5a660000-0000-4000-8000-0000000002a1', '5a660000-0000-4000-8000-000000000103',
               '5a660000-0000-4000-8000-0000000000c2', 'add', 1.5, true)$q$, '23514');
SELECT pg_temp.expect_refused('one suggestion per message and label in a run',
    $q$INSERT INTO minerva.mail_suggestions (run_id, message_id, label_id, action, confidence, ticked)
       VALUES ('5a660000-0000-4000-8000-0000000002a1', '5a660000-0000-4000-8000-000000000106',
               '5a660000-0000-4000-8000-0000000000c1', 'remove', 0.5, false)$q$, '23505');

-- Deleting a run takes its suggestions with it.
DELETE FROM minerva.mail_suggestion_runs WHERE id = '5a660000-0000-4000-8000-0000000002a1';
SELECT pg_temp.expect('a deleted run leaves nothing behind',
    (SELECT count(*) = 0 FROM minerva.mail_suggestions));

ROLLBACK;
