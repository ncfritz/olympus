-- Checks for migration 1791310000000_minerva_mail_label_ops. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_label_ops.sql <database>

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
    ('8e8e0000-0000-4000-8000-000000000001', 'Ops', 'ops@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('8e8e0000-0000-4000-8000-0000000000a1', '8e8e0000-0000-4000-8000-000000000001', 'ops@example.test', now(), 'import');
INSERT INTO minerva.mail_change_batches (id, account_id, user_id, kind) VALUES
    ('8e8e0000-0000-4000-8000-0000000000b1', '8e8e0000-0000-4000-8000-0000000000a1', '8e8e0000-0000-4000-8000-000000000001', 'merge');
INSERT INTO minerva.mail_change_label_ops (batch_id, op, name, new_name) VALUES
    ('8e8e0000-0000-4000-8000-0000000000b1', 'rename', 'zz-test/b/x', 'zz-test/a/x'),
    ('8e8e0000-0000-4000-8000-0000000000b1', 'delete', 'zz-test/b', NULL),
    ('8e8e0000-0000-4000-8000-0000000000b1', 'create', 'zz-test/c', NULL);

SELECT pg_temp.expect('a merge batch holds its operations',
    (SELECT count(*) = 3 FROM minerva.mail_change_label_ops
      WHERE batch_id = '8e8e0000-0000-4000-8000-0000000000b1'));
SELECT pg_temp.expect_refused('a rename names where it goes',
    $q$INSERT INTO minerva.mail_change_label_ops (batch_id, op, name)
       VALUES ('8e8e0000-0000-4000-8000-0000000000b1', 'rename', 'zz-test/y')$q$, '23514');
SELECT pg_temp.expect_refused('only a rename has a new name',
    $q$INSERT INTO minerva.mail_change_label_ops (batch_id, op, name, new_name)
       VALUES ('8e8e0000-0000-4000-8000-0000000000b1', 'delete', 'zz-test/y', 'zz-test/z')$q$, '23514');
SELECT pg_temp.expect_refused('the same operation on a label twice',
    $q$INSERT INTO minerva.mail_change_label_ops (batch_id, op, name)
       VALUES ('8e8e0000-0000-4000-8000-0000000000b1', 'delete', 'zz-test/b')$q$, '23505');
SELECT pg_temp.expect_refused('an unknown operation',
    $q$INSERT INTO minerva.mail_change_label_ops (batch_id, op, name)
       VALUES ('8e8e0000-0000-4000-8000-0000000000b1', 'hide', 'zz-test/y')$q$, '23514');
SELECT pg_temp.expect_refused('a batch of an unknown kind',
    $q$INSERT INTO minerva.mail_change_batches (account_id, user_id, kind)
       VALUES ('8e8e0000-0000-4000-8000-0000000000a1', '8e8e0000-0000-4000-8000-000000000001', 'split')$q$, '23514');

DELETE FROM minerva.mail_change_batches WHERE id = '8e8e0000-0000-4000-8000-0000000000b1';
SELECT pg_temp.expect('operations go with their batch',
    (SELECT count(*) = 0 FROM minerva.mail_change_label_ops
      WHERE batch_id = '8e8e0000-0000-4000-8000-0000000000b1'));

ROLLBACK;
