-- Checks for the mail tables (migration 1791200000000_minerva_mail). Runs
-- in a transaction that is rolled back, so it is safe on any database
-- with the migrations applied, and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

-- Runs `statement` and fails unless it is refused with `code` (a SQLSTATE).
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
END;
$$;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS NOT TRUE THEN RAISE EXCEPTION '%', label; END IF;
END;
$$;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('6a1a0c6e-0000-4000-8000-000000000001', 'Mail Check A', 'mail-check-a@example.test'),
    ('6a1a0c6e-0000-4000-8000-0000000000ff', 'Mail Check B', 'mail-check-b@example.test');

INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('7b2b0000-0000-4000-8000-000000000001', '6a1a0c6e-0000-4000-8000-000000000001',
     'owner@example.test', now(), 'import');

-- Accounts: one per address, lower case; a subject once, when linked.
SELECT pg_temp.expect_refused('same address twice',
    $q$INSERT INTO minerva.mail_accounts (user_id, email, verified_at, verification_method)
       VALUES ('6a1a0c6e-0000-4000-8000-0000000000ff', 'owner@example.test', now(), 'import')$q$, '23505');
SELECT pg_temp.expect_refused('upper-case address',
    $q$INSERT INTO minerva.mail_accounts (user_id, email, verified_at, verification_method)
       VALUES ('6a1a0c6e-0000-4000-8000-0000000000ff', 'Other@example.test', now(), 'import')$q$, '23514');
SELECT pg_temp.expect_refused('unknown verification',
    $q$INSERT INTO minerva.mail_accounts (user_id, email, verified_at, verification_method)
       VALUES ('6a1a0c6e-0000-4000-8000-0000000000ff', 'b@example.test', now(), 'guess')$q$, '23514');
SELECT pg_temp.expect_refused('another provider',
    $q$INSERT INTO minerva.mail_accounts (user_id, provider, email, verified_at, verification_method)
       VALUES ('6a1a0c6e-0000-4000-8000-0000000000ff', 'microsoft', 'b@example.test', now(), 'import')$q$, '23514');
-- A subject comes with its link (1791270000000_minerva_mail_sync).
INSERT INTO minerva.mail_accounts (id, user_id, email, subject, linked_at, link_scope, verified_at, verification_method) VALUES
    ('7b2b0000-0000-4000-8000-0000000000ff', '6a1a0c6e-0000-4000-8000-0000000000ff',
     'b@example.test', 'sub-1', now(), 'openid email', now(), 'consent');
SELECT pg_temp.expect_refused('same subject twice',
    $q$UPDATE minerva.mail_accounts SET subject = 'sub-1', linked_at = now(), link_scope = 'openid email'
       WHERE id = '7b2b0000-0000-4000-8000-000000000001'$q$, '23505');

-- Labels: unique per account by name; the parent from the path.
INSERT INTO minerva.mail_labels (id, account_id, name) VALUES
    ('8c3c0000-0000-4000-8000-000000000001', '7b2b0000-0000-4000-8000-000000000001', 'Accounts/Utilities/Power'),
    ('8c3c0000-0000-4000-8000-000000000002', '7b2b0000-0000-4000-8000-000000000001', 'Bills');
INSERT INTO minerva.mail_labels (id, account_id, name, type) VALUES
    ('8c3c0000-0000-4000-8000-000000000003', '7b2b0000-0000-4000-8000-000000000001', 'CATEGORY_UPDATES', 'system');
SELECT pg_temp.expect('nested label parent',
    (SELECT parent_name FROM minerva.mail_labels WHERE id = '8c3c0000-0000-4000-8000-000000000001') = 'Accounts/Utilities');
SELECT pg_temp.expect('top-level label has no parent',
    (SELECT parent_name FROM minerva.mail_labels WHERE id = '8c3c0000-0000-4000-8000-000000000002') IS NULL);
SELECT pg_temp.expect_refused('same label twice',
    $q$INSERT INTO minerva.mail_labels (account_id, name) VALUES ('7b2b0000-0000-4000-8000-000000000001', 'Bills')$q$, '23505');
SELECT pg_temp.expect_refused('padded label name',
    $q$INSERT INTO minerva.mail_labels (account_id, name) VALUES ('7b2b0000-0000-4000-8000-000000000001', ' Bills')$q$, '23514');
SELECT pg_temp.expect_refused('226-character label',
    $q$INSERT INTO minerva.mail_labels (account_id, name) VALUES ('7b2b0000-0000-4000-8000-000000000001', repeat('x', 226))$q$, '23514');
SELECT pg_temp.expect_refused('unknown label type',
    $q$INSERT INTO minerva.mail_labels (account_id, name, type) VALUES ('7b2b0000-0000-4000-8000-000000000001', 'X', 'smart')$q$, '23514');
-- Another account may have the same name.
INSERT INTO minerva.mail_labels (account_id, name) VALUES ('7b2b0000-0000-4000-8000-0000000000ff', 'Bills');

-- Messages: Gmail's hexadecimal IDs, once per account; the snippet at most
-- 200 characters; the domain from the sender.
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time,
    received_at, from_address, snippet, size_bytes, in_inbox)
VALUES ('9d4d0000-0000-4000-8000-000000000001', '7b2b0000-0000-4000-8000-000000000001',
    '1a0fab8f293aa5b5', '1a0fab8f293aa5b5', 'takeout', now(), now(), 'billing@power.example', 'Your bill', 2048, true);
SELECT pg_temp.expect('sender domain',
    (SELECT from_domain FROM minerva.mail_messages WHERE id = '9d4d0000-0000-4000-8000-000000000001') = 'power.example');
SELECT pg_temp.expect_refused('same message twice',
    $q$INSERT INTO minerva.mail_messages (account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes)
       VALUES ('7b2b0000-0000-4000-8000-000000000001', '1a0fab8f293aa5b5', '1', 'takeout', now(), now(), '', 1)$q$, '23505');
SELECT pg_temp.expect_refused('decimal message ID',
    $q$INSERT INTO minerva.mail_messages (account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes)
       VALUES ('7b2b0000-0000-4000-8000-000000000001', '1877908200997168565', '1', 'takeout', now(), now(), '', 1)$q$, '23514');
SELECT pg_temp.expect_refused('upper-case thread ID',
    $q$INSERT INTO minerva.mail_messages (account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes)
       VALUES ('7b2b0000-0000-4000-8000-000000000001', 'ab', 'AB', 'takeout', now(), now(), '', 1)$q$, '23514');
SELECT pg_temp.expect_refused('201-character snippet',
    $q$INSERT INTO minerva.mail_messages (account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes)
       VALUES ('7b2b0000-0000-4000-8000-000000000001', 'ac', 'ac', 'takeout', now(), now(), repeat('é', 201), 1)$q$, '23514');
-- 200 characters, however many bytes, is allowed.
INSERT INTO minerva.mail_messages (account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes)
    VALUES ('7b2b0000-0000-4000-8000-000000000001', 'ad', 'ad', 'takeout', now(), now(), repeat('é', 200), 1);
SELECT pg_temp.expect_refused('unknown source',
    $q$INSERT INTO minerva.mail_messages (account_id, gmail_id, thread_id, source, snapshot_time, received_at, snippet, size_bytes)
       VALUES ('7b2b0000-0000-4000-8000-000000000001', 'ae', 'ae', 'imap', now(), now(), '', 1)$q$, '23514');
SELECT pg_temp.expect_refused('upper-case sender',
    $q$INSERT INTO minerva.mail_messages (account_id, gmail_id, thread_id, source, snapshot_time, received_at, from_address, snippet, size_bytes)
       VALUES ('7b2b0000-0000-4000-8000-000000000001', 'af', 'af', 'takeout', now(), now(), 'A@b.example', '', 1)$q$, '23514');

-- Recipients, attachments and labels belong to their message.
INSERT INTO minerva.mail_message_recipients (message_id, kind, position, address, name) VALUES
    ('9d4d0000-0000-4000-8000-000000000001', 'to', 0, 'owner@example.test', 'Owner'),
    ('9d4d0000-0000-4000-8000-000000000001', 'reply_to', 0, 'help@power.example', NULL);
SELECT pg_temp.expect_refused('unknown recipient kind',
    $q$INSERT INTO minerva.mail_message_recipients (message_id, kind, position, address)
       VALUES ('9d4d0000-0000-4000-8000-000000000001', 'bcc', 0, 'x@example.test')$q$, '23514');
INSERT INTO minerva.mail_message_attachments (message_id, position, mime_type, extension, size_bytes, inline) VALUES
    ('9d4d0000-0000-4000-8000-000000000001', 0, 'application/pdf', 'pdf', 300, false);
SELECT pg_temp.expect_refused('extension with a dot',
    $q$INSERT INTO minerva.mail_message_attachments (message_id, position, mime_type, extension, size_bytes, inline)
       VALUES ('9d4d0000-0000-4000-8000-000000000001', 1, 'application/pdf', '.pdf', 1, false)$q$, '23514');
INSERT INTO minerva.mail_message_labels (message_id, label_id) VALUES
    ('9d4d0000-0000-4000-8000-000000000001', '8c3c0000-0000-4000-8000-000000000001'),
    ('9d4d0000-0000-4000-8000-000000000001', '8c3c0000-0000-4000-8000-000000000003');
SELECT pg_temp.expect_refused('label twice on a message',
    $q$INSERT INTO minerva.mail_message_labels (message_id, label_id)
       VALUES ('9d4d0000-0000-4000-8000-000000000001', '8c3c0000-0000-4000-8000-000000000001')$q$, '23505');

-- Audit times: an update moves updated_at and leaves created_at.
UPDATE minerva.mail_messages SET created_at = now() - interval '1 day', updated_at = now() - interval '1 day'
    WHERE id = '9d4d0000-0000-4000-8000-000000000001';
UPDATE minerva.mail_messages SET unread = true WHERE id = '9d4d0000-0000-4000-8000-000000000001';
SELECT pg_temp.expect('message audit times',
    (SELECT updated_at > created_at AND created_at < now() - interval '23 hours'
       FROM minerva.mail_messages WHERE id = '9d4d0000-0000-4000-8000-000000000001'));
UPDATE minerva.mail_labels SET created_at = now() - interval '1 day', updated_at = now() - interval '1 day'
    WHERE id = '8c3c0000-0000-4000-8000-000000000002';
UPDATE minerva.mail_labels SET gmail_label_id = 'Label_2' WHERE id = '8c3c0000-0000-4000-8000-000000000002';
SELECT pg_temp.expect('label audit times',
    (SELECT updated_at > created_at FROM minerva.mail_labels WHERE id = '8c3c0000-0000-4000-8000-000000000002'));
SELECT pg_temp.expect_refused('Gmail label ID twice in an account',
    $q$UPDATE minerva.mail_labels SET gmail_label_id = 'Label_2' WHERE id = '8c3c0000-0000-4000-8000-000000000001'$q$, '23505');

-- Deleting a label takes it off its messages; deleting a message takes its
-- rows; deleting the user takes the account and everything under it.
DELETE FROM minerva.mail_labels WHERE id = '8c3c0000-0000-4000-8000-000000000003';
SELECT pg_temp.expect('label removed from message',
    (SELECT count(*) FROM minerva.mail_message_labels WHERE message_id = '9d4d0000-0000-4000-8000-000000000001') = 1);
DELETE FROM olympus.users WHERE id = '6a1a0c6e-0000-4000-8000-000000000001';
SELECT pg_temp.expect('account cascade',
    (SELECT count(*) FROM minerva.mail_accounts WHERE id = '7b2b0000-0000-4000-8000-000000000001') = 0
    AND (SELECT count(*) FROM minerva.mail_labels WHERE account_id = '7b2b0000-0000-4000-8000-000000000001') = 0
    AND (SELECT count(*) FROM minerva.mail_messages WHERE account_id = '7b2b0000-0000-4000-8000-000000000001') = 0
    AND (SELECT count(*) FROM minerva.mail_message_recipients WHERE message_id = '9d4d0000-0000-4000-8000-000000000001') = 0
    AND (SELECT count(*) FROM minerva.mail_message_attachments WHERE message_id = '9d4d0000-0000-4000-8000-000000000001') = 0);
-- The other user's account is untouched.
SELECT pg_temp.expect('other account kept',
    (SELECT count(*) FROM minerva.mail_labels WHERE account_id = '7b2b0000-0000-4000-8000-0000000000ff') = 1);

ROLLBACK;
