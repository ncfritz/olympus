-- Checks for migration 1791290000000_minerva_mail_changes. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_changes.sql <database>

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
    ('6c6c0000-0000-4000-8000-000000000001', 'Changes', 'changes@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('6c6c0000-0000-4000-8000-0000000000a1', '6c6c0000-0000-4000-8000-000000000001', 'changes@example.test', now(), 'import');
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes) VALUES
    ('6c6c0000-0000-4000-8000-0000000000b1', '6c6c0000-0000-4000-8000-0000000000a1', 'b1', 'b1', 'gmail', now(), now(), '', 1);
INSERT INTO minerva.mail_labels (id, account_id, name) VALUES
    ('6c6c0000-0000-4000-8000-0000000000c1', '6c6c0000-0000-4000-8000-0000000000a1', 'Travel');
INSERT INTO minerva.mail_suggestion_runs (id, account_id, model_run, feature_version, status, finished_at, messages_scored) VALUES
    ('6c6c0000-0000-4000-8000-0000000000d1', '6c6c0000-0000-4000-8000-0000000000a1', 'run-1', 'v1', 'ready', now(), 1);
INSERT INTO minerva.mail_suggestions (run_id, message_id, label_id, action, confidence, ticked) VALUES
    ('6c6c0000-0000-4000-8000-0000000000d1', '6c6c0000-0000-4000-8000-0000000000b1', '6c6c0000-0000-4000-8000-0000000000c1', 'add', 0.95, true);

SELECT pg_temp.expect('a proposal starts undecided',
    (SELECT decision IS NULL FROM minerva.mail_proposals
      WHERE message_id = '6c6c0000-0000-4000-8000-0000000000b1'));

-- An apply, with its change and the labels before.
INSERT INTO minerva.mail_change_batches (id, account_id, user_id, kind) VALUES
    ('6c6c0000-0000-4000-8000-0000000000e1', '6c6c0000-0000-4000-8000-0000000000a1', '6c6c0000-0000-4000-8000-000000000001', 'apply');
INSERT INTO minerva.mail_changes (id, batch_id, gmail_id, message_id) VALUES
    ('6c6c0000-0000-4000-8000-0000000000f1', '6c6c0000-0000-4000-8000-0000000000e1', 'b1', '6c6c0000-0000-4000-8000-0000000000b1');
INSERT INTO minerva.mail_change_labels (change_id, role, name) VALUES
    ('6c6c0000-0000-4000-8000-0000000000f1', 'had', 'Accounts/A'),
    ('6c6c0000-0000-4000-8000-0000000000f1', 'add', 'Travel');
INSERT INTO minerva.mail_decisions (account_id, message_id, label_id, action, decision, batch_id, user_id) VALUES
    ('6c6c0000-0000-4000-8000-0000000000a1', '6c6c0000-0000-4000-8000-0000000000b1', '6c6c0000-0000-4000-8000-0000000000c1',
     'add', 'applied', '6c6c0000-0000-4000-8000-0000000000e1', '6c6c0000-0000-4000-8000-000000000001');
SELECT pg_temp.expect('the proposal shows it was applied',
    (SELECT decision = 'applied' FROM minerva.mail_proposals
      WHERE message_id = '6c6c0000-0000-4000-8000-0000000000b1'));

SELECT pg_temp.expect_refused('an undo names the batch it reverses',
    $q$INSERT INTO minerva.mail_change_batches (account_id, user_id, kind) VALUES
       ('6c6c0000-0000-4000-8000-0000000000a1', '6c6c0000-0000-4000-8000-000000000001', 'undo')$q$, '23514');
SELECT pg_temp.expect_refused('a finished batch says when',
    $q$UPDATE minerva.mail_change_batches SET status = 'done'
       WHERE id = '6c6c0000-0000-4000-8000-0000000000e1'$q$, '23514');
SELECT pg_temp.expect_refused('a failed batch says why',
    $q$UPDATE minerva.mail_change_batches SET status = 'failed', finished_at = now()
       WHERE id = '6c6c0000-0000-4000-8000-0000000000e1'$q$, '23514');
SELECT pg_temp.expect_refused('an applied decision names its batch',
    $q$UPDATE minerva.mail_decisions SET batch_id = NULL
       WHERE message_id = '6c6c0000-0000-4000-8000-0000000000b1'$q$, '23514');
SELECT pg_temp.expect_refused('a change of an unknown kind',
    $q$UPDATE minerva.mail_changes SET status = 'maybe'
       WHERE id = '6c6c0000-0000-4000-8000-0000000000f1'$q$, '23514');
SELECT pg_temp.expect_refused('a label that is neither had, added nor removed',
    $q$INSERT INTO minerva.mail_change_labels (change_id, role, name)
       VALUES ('6c6c0000-0000-4000-8000-0000000000f1', 'kept', 'X')$q$, '23514');

INSERT INTO minerva.mail_change_batches (id, account_id, user_id, kind, undoes_batch_id) VALUES
    ('6c6c0000-0000-4000-8000-0000000000e2', '6c6c0000-0000-4000-8000-0000000000a1', '6c6c0000-0000-4000-8000-000000000001',
     'undo', '6c6c0000-0000-4000-8000-0000000000e1');
SELECT pg_temp.expect_refused('a batch is undone once',
    $q$INSERT INTO minerva.mail_change_batches (account_id, user_id, kind, undoes_batch_id) VALUES
       ('6c6c0000-0000-4000-8000-0000000000a1', '6c6c0000-0000-4000-8000-000000000001', 'undo',
        '6c6c0000-0000-4000-8000-0000000000e1')$q$, '23505');

-- The log outlives the message; its decisions do not.
DELETE FROM minerva.mail_messages WHERE id = '6c6c0000-0000-4000-8000-0000000000b1';
SELECT pg_temp.expect('a change keeps its Gmail ID when the message goes',
    (SELECT message_id IS NULL AND gmail_id = 'b1' FROM minerva.mail_changes
      WHERE id = '6c6c0000-0000-4000-8000-0000000000f1'));
SELECT pg_temp.expect('and its labels',
    (SELECT count(*) = 2 FROM minerva.mail_change_labels
      WHERE change_id = '6c6c0000-0000-4000-8000-0000000000f1'));
SELECT pg_temp.expect('a decision goes with its message',
    (SELECT count(*) = 0 FROM minerva.mail_decisions
      WHERE account_id = '6c6c0000-0000-4000-8000-0000000000a1'));

ROLLBACK;
