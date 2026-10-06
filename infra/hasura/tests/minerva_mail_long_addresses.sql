-- Checks for migration 1791210000000_minerva_mail_long_addresses. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_long_addresses.sql <database>

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

INSERT INTO olympus.users (id, display_name, email)
    VALUES ('7c3c0000-0000-4000-8000-000000000001', 'Long Addresses', 'long-addresses@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method)
    VALUES ('7c3c0000-0000-4000-8000-000000000002', '7c3c0000-0000-4000-8000-000000000001',
            'long-addresses@example.test', now(), 'import');
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes)
    VALUES ('7c3c0000-0000-4000-8000-000000000003', '7c3c0000-0000-4000-8000-000000000002', 'a1', 'a1', 'takeout', now(), now(), '', 1);

-- A tracking address past RFC 5321's 320 characters is kept.
INSERT INTO minerva.mail_message_recipients (message_id, kind, position, address)
    VALUES ('7c3c0000-0000-4000-8000-000000000003', 'reply_to', 0, repeat('t', 310) || '@b.example');
SELECT pg_temp.expect_refused('address past 1,024 characters',
    $q$INSERT INTO minerva.mail_message_recipients (message_id, kind, position, address)
       VALUES ('7c3c0000-0000-4000-8000-000000000003', 'reply_to', 1, repeat('t', 1015) || '@b.example')$q$, '23514');
SELECT pg_temp.expect_refused('upper-case address',
    $q$INSERT INTO minerva.mail_message_recipients (message_id, kind, position, address)
       VALUES ('7c3c0000-0000-4000-8000-000000000003', 'reply_to', 2, 'T@b.example')$q$, '23514');

ROLLBACK;
