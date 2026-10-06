-- Checks for migration 1791280000000_minerva_mail_star_icons. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_star_icons.sql <database>

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
INSERT INTO minerva.mail_messages (account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes, starred, star_icon) VALUES
    ('5a5a0000-0000-4000-8000-0000000000a1', 'a1', 'a1', 'gmail', now(), now(), '', 1, true, 'red-bang'),
    ('5a5a0000-0000-4000-8000-0000000000a1', 'a2', 'a2', 'gmail', now(), now(), '', 1, true, NULL),
    ('5a5a0000-0000-4000-8000-0000000000a1', 'a3', 'a3', 'gmail', now(), now(), '', 1, false, NULL);

SELECT pg_temp.expect('a starred message keeps its icon, or has none found',
    (SELECT count(*) = 2 FROM minerva.mail_messages
      WHERE account_id = '5a5a0000-0000-4000-8000-0000000000a1' AND starred));
SELECT pg_temp.expect_refused('an icon Gmail does not have',
    $q$UPDATE minerva.mail_messages SET star_icon = 'pink-heart' WHERE gmail_id = 'a2'$q$, '23514');
SELECT pg_temp.expect_refused('an icon on a message that is not starred',
    $q$UPDATE minerva.mail_messages SET star_icon = 'yellow-star' WHERE gmail_id = 'a3'$q$, '23514');
SELECT pg_temp.expect_refused('unstarring leaves no icon behind',
    $q$UPDATE minerva.mail_messages SET starred = false WHERE gmail_id = 'a1'$q$, '23514');
UPDATE minerva.mail_messages SET starred = false, star_icon = NULL WHERE gmail_id = 'a1';

ROLLBACK;
