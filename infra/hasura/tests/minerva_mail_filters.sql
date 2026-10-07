-- Checks for migration 1791370000000_minerva_mail_filters. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_filters.sql <database>

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
    ('5c5c0000-0000-4000-8000-000000000001', 'Filters', 'filters@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('5c5c0000-0000-4000-8000-0000000000a1', '5c5c0000-0000-4000-8000-000000000001', 'filters@example.test', now(), 'import');
INSERT INTO minerva.mail_labels (id, account_id, name, type) VALUES
    ('5c5c0000-0000-4000-8000-0000000000c1', '5c5c0000-0000-4000-8000-0000000000a1', 'Shopping', 'user'),
    ('5c5c0000-0000-4000-8000-0000000000c2', '5c5c0000-0000-4000-8000-0000000000a1', 'Travel', 'user');

-- shop.example: 25 approved, all Shopping. air.example: 25 approved, 24
-- Travel (96%). few.example: 5 approved, all Shopping.
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at,
                                   from_address, snippet, size_bytes, in_inbox)
SELECT ('5c5c0000-0000-4000-8000-' || lpad(to_hex(n), 12, '0'))::uuid,
       '5c5c0000-0000-4000-8000-0000000000a1', to_hex(4096 + n), to_hex(4096 + n), 'gmail', now(), now(),
       CASE WHEN n <= 25 THEN 'orders@shop.example' WHEN n <= 50 THEN 'trips@air.example' ELSE 'hi@few.example' END,
       '', 1, false
FROM generate_series(1, 55) n;
INSERT INTO minerva.mail_inbox_decisions (message_id, account_id, decision, user_id)
SELECT id, account_id, 'approved', '5c5c0000-0000-4000-8000-000000000001'
FROM minerva.mail_messages WHERE account_id = '5c5c0000-0000-4000-8000-0000000000a1';
INSERT INTO minerva.mail_message_labels (message_id, label_id)
SELECT id, CASE WHEN from_address = 'trips@air.example' THEN '5c5c0000-0000-4000-8000-0000000000c2'::uuid
                ELSE '5c5c0000-0000-4000-8000-0000000000c1'::uuid END
FROM minerva.mail_messages
WHERE account_id = '5c5c0000-0000-4000-8000-0000000000a1'
  AND id <> '5c5c0000-0000-4000-8000-000000000032';

SELECT pg_temp.expect('a sender at the threshold is proposed; one below, or with too few, is not',
    (SELECT array_agg(from_address || ':' || label || ':' || kept || '/' || decisions)
       FROM minerva.mail_filter_proposals
      WHERE account_id = '5c5c0000-0000-4000-8000-0000000000a1')
    = ARRAY['orders@shop.example:Shopping:25/25']);

SELECT pg_temp.expect_refused('a sender that is not an address',
    $q$INSERT INTO minerva.mail_filters (account_id, from_address, label_id, skip_inbox, gmail_filter_id, user_id)
       VALUES ('5c5c0000-0000-4000-8000-0000000000a1', 'Orders@Shop.example', '5c5c0000-0000-4000-8000-0000000000c1',
               true, 'f1', '5c5c0000-0000-4000-8000-000000000001')$q$, '23514');

-- A filter made: no longer proposed, and its mail in the inbox is handled.
INSERT INTO minerva.mail_filters (account_id, from_address, label_id, skip_inbox, gmail_filter_id, user_id)
VALUES ('5c5c0000-0000-4000-8000-0000000000a1', 'orders@shop.example', '5c5c0000-0000-4000-8000-0000000000c1',
        false, 'ANe1Bmj', '5c5c0000-0000-4000-8000-000000000001');
SELECT pg_temp.expect('a filtered sender is not proposed again',
    NOT EXISTS (SELECT 1 FROM minerva.mail_filter_proposals
                 WHERE account_id = '5c5c0000-0000-4000-8000-0000000000a1'));
UPDATE minerva.mail_messages SET in_inbox = true
 WHERE id IN ('5c5c0000-0000-4000-8000-000000000001', '5c5c0000-0000-4000-8000-00000000001a');
SELECT pg_temp.expect('its mail is filtered; other mail is not',
    (SELECT bool_and(filtered) FROM minerva.mail_inbox WHERE message_id = '5c5c0000-0000-4000-8000-000000000001')
    AND (SELECT NOT bool_or(filtered) FROM minerva.mail_inbox WHERE message_id = '5c5c0000-0000-4000-8000-00000000001a'));

-- A dismissal keeps a proposal away.
DELETE FROM minerva.mail_filters WHERE gmail_filter_id = 'ANe1Bmj';
INSERT INTO minerva.mail_filter_dismissals (account_id, from_address, label_id)
VALUES ('5c5c0000-0000-4000-8000-0000000000a1', 'orders@shop.example', '5c5c0000-0000-4000-8000-0000000000c1');
SELECT pg_temp.expect('a declined proposal is not proposed again',
    NOT EXISTS (SELECT 1 FROM minerva.mail_filter_proposals
                 WHERE account_id = '5c5c0000-0000-4000-8000-0000000000a1'));

ROLLBACK;
