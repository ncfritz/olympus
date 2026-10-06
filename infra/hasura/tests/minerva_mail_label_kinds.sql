-- Checks for migration 1791240000000_minerva_mail_label_kinds. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_label_kinds.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

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
CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS NOT TRUE THEN RAISE EXCEPTION '%: wrong', label; END IF;
END $$;

INSERT INTO olympus.users (id, display_name, email)
    VALUES ('6d1d0000-0000-4000-8000-000000000001', 'Kinds', 'kinds@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method)
    VALUES ('6d1d0000-0000-4000-8000-0000000000a1', '6d1d0000-0000-4000-8000-000000000001', 'kinds@example.test', now(), 'import');
INSERT INTO minerva.mail_labels (id, account_id, name, type) VALUES
    ('6d1d0000-0000-4000-8000-000000000101', '6d1d0000-0000-4000-8000-0000000000a1', 'Bills/SRP', 'user'),
    ('6d1d0000-0000-4000-8000-000000000102', '6d1d0000-0000-4000-8000-0000000000a1', 'Bills/*Payable', 'user'),
    ('6d1d0000-0000-4000-8000-000000000103', '6d1d0000-0000-4000-8000-0000000000a1', 'Bills/*Paid', 'user'),
    ('6d1d0000-0000-4000-8000-000000000104', '6d1d0000-0000-4000-8000-0000000000a1', 'Advertisements', 'user'),
    ('6d1d0000-0000-4000-8000-000000000105', '6d1d0000-0000-4000-8000-0000000000a1', 'CATEGORY_UPDATES', 'system');

SELECT pg_temp.expect('a user label starts topical',
    (SELECT kind = 'topical' FROM minerva.mail_labels WHERE id = '6d1d0000-0000-4000-8000-000000000101'));
SELECT pg_temp.expect('a system label is system',
    (SELECT kind = 'system' FROM minerva.mail_labels WHERE id = '6d1d0000-0000-4000-8000-000000000105'));
SELECT pg_temp.expect_refused('a user label cannot be system',
    $q$UPDATE minerva.mail_labels SET kind = 'system' WHERE id = '6d1d0000-0000-4000-8000-000000000101'$q$, '23514');

-- The Bills family: Payable (initial, open) to Paid (closed).
INSERT INTO minerva.mail_label_families (id, account_id, name)
    VALUES ('6d1d0000-0000-4000-8000-000000000201', '6d1d0000-0000-4000-8000-0000000000a1', 'Bills');
SELECT pg_temp.expect_refused('a state needs open or closed',
    $q$UPDATE minerva.mail_labels SET kind = 'state', family_id = '6d1d0000-0000-4000-8000-000000000201'
       WHERE id = '6d1d0000-0000-4000-8000-000000000102'$q$, '23514');
SELECT pg_temp.expect_refused('a state needs a family',
    $q$UPDATE minerva.mail_labels SET kind = 'state', state_open = true
       WHERE id = '6d1d0000-0000-4000-8000-000000000102'$q$, '23514');
UPDATE minerva.mail_labels SET kind = 'state', family_id = '6d1d0000-0000-4000-8000-000000000201', state_open = true
    WHERE id = '6d1d0000-0000-4000-8000-000000000102';
UPDATE minerva.mail_labels SET kind = 'state', family_id = '6d1d0000-0000-4000-8000-000000000201', state_open = false
    WHERE id = '6d1d0000-0000-4000-8000-000000000103';
UPDATE minerva.mail_label_families SET initial_label_id = '6d1d0000-0000-4000-8000-000000000102'
    WHERE id = '6d1d0000-0000-4000-8000-000000000201';
INSERT INTO minerva.mail_label_transitions (family_id, from_label_id, to_label_id)
    VALUES ('6d1d0000-0000-4000-8000-000000000201', '6d1d0000-0000-4000-8000-000000000102', '6d1d0000-0000-4000-8000-000000000103');
SELECT pg_temp.expect_refused('no transition to itself',
    $q$INSERT INTO minerva.mail_label_transitions (family_id, from_label_id, to_label_id)
       VALUES ('6d1d0000-0000-4000-8000-000000000201', '6d1d0000-0000-4000-8000-000000000103', '6d1d0000-0000-4000-8000-000000000103')$q$, '23514');
SELECT pg_temp.expect_refused('a topical label has no family',
    $q$UPDATE minerva.mail_labels SET family_id = '6d1d0000-0000-4000-8000-000000000201'
       WHERE id = '6d1d0000-0000-4000-8000-000000000101'$q$, '23514');
SELECT pg_temp.expect_refused('a family with states cannot simply go',
    $q$DELETE FROM minerva.mail_label_families WHERE id = '6d1d0000-0000-4000-8000-000000000201'$q$, '23503');
SELECT pg_temp.expect_refused('one family name per account',
    $q$INSERT INTO minerva.mail_label_families (account_id, name)
       VALUES ('6d1d0000-0000-4000-8000-0000000000a1', 'Bills')$q$, '23505');

-- Retired: needs a target, not itself.
SELECT pg_temp.expect_refused('retired needs a target',
    $q$UPDATE minerva.mail_labels SET kind = 'retired' WHERE id = '6d1d0000-0000-4000-8000-000000000104'$q$, '23514');
SELECT pg_temp.expect_refused('not merged into itself',
    $q$UPDATE minerva.mail_labels SET kind = 'retired', merge_target_id = '6d1d0000-0000-4000-8000-000000000104'
       WHERE id = '6d1d0000-0000-4000-8000-000000000104'$q$, '23514');
UPDATE minerva.mail_labels SET kind = 'retired', merge_target_id = '6d1d0000-0000-4000-8000-000000000101'
    WHERE id = '6d1d0000-0000-4000-8000-000000000104';
SELECT pg_temp.expect_refused('a merge target cannot be deleted from under it',
    $q$DELETE FROM minerva.mail_labels WHERE id = '6d1d0000-0000-4000-8000-000000000101'$q$, '23503');

-- Taking the states back to topical lets the family go, transitions with it.
UPDATE minerva.mail_labels SET kind = 'topical', family_id = NULL, state_open = NULL
    WHERE family_id = '6d1d0000-0000-4000-8000-000000000201';
DELETE FROM minerva.mail_label_families WHERE id = '6d1d0000-0000-4000-8000-000000000201';
SELECT pg_temp.expect('transitions go with their family',
    (SELECT count(*) = 0 FROM minerva.mail_label_transitions WHERE family_id = '6d1d0000-0000-4000-8000-000000000201'));

ROLLBACK;
