-- Checks for migration 1791220000000_minerva_mail_statistics. Runs in a
-- transaction that is rolled back, so it is safe on any database with the
-- migrations applied, and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_statistics.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS NOT TRUE THEN RAISE EXCEPTION '%: wrong', label; END IF;
END $$;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('6b1b0000-0000-4000-8000-000000000001', 'Stats A', 'stats-a@example.test'),
    ('6b1b0000-0000-4000-8000-000000000002', 'Stats B', 'stats-b@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('6b1b0000-0000-4000-8000-0000000000a1', '6b1b0000-0000-4000-8000-000000000001', 'stats-a@example.test', now(), 'import'),
    ('6b1b0000-0000-4000-8000-0000000000b1', '6b1b0000-0000-4000-8000-000000000002', 'stats-b@example.test', now(), 'import');
INSERT INTO minerva.mail_labels (id, account_id, name, type) VALUES
    ('6b1b0000-0000-4000-8000-0000000001a1', '6b1b0000-0000-4000-8000-0000000000a1', 'Bills/Power', 'user'),
    ('6b1b0000-0000-4000-8000-0000000001a2', '6b1b0000-0000-4000-8000-0000000000a1', 'Shopping', 'user'),
    ('6b1b0000-0000-4000-8000-0000000001a3', '6b1b0000-0000-4000-8000-0000000000a1', 'CATEGORY_UPDATES', 'system'),
    ('6b1b0000-0000-4000-8000-0000000001b1', '6b1b0000-0000-4000-8000-0000000000b1', 'Bills/Power', 'user');

-- A: power bills in 2024 and 2025, a shop in 2025, one sent, one unlabelled.
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at, from_address, from_name, snippet, size_bytes, sent) VALUES
    ('6b1b0000-0000-4000-8000-000000000101', '6b1b0000-0000-4000-8000-0000000000a1', 'a1', 'a1', 'takeout', now(), '2024-03-01T12:00Z', 'bill@power.example', 'Power', '', 1, false),
    ('6b1b0000-0000-4000-8000-000000000102', '6b1b0000-0000-4000-8000-0000000000a1', 'a2', 'a2', 'takeout', now(), '2025-03-01T12:00Z', 'bill@power.example', 'Power Co', '', 1, false),
    ('6b1b0000-0000-4000-8000-000000000103', '6b1b0000-0000-4000-8000-0000000000a1', 'a3', 'a3', 'takeout', now(), '2025-04-01T12:00Z', 'bill@power.example', 'Power Co', '', 1, false),
    ('6b1b0000-0000-4000-8000-000000000104', '6b1b0000-0000-4000-8000-0000000000a1', 'a4', 'a4', 'takeout', now(), '2025-05-01T12:00Z', 'orders@shop.example', 'Shop', '', 1, false),
    ('6b1b0000-0000-4000-8000-000000000105', '6b1b0000-0000-4000-8000-0000000000a1', 'a5', 'a5', 'takeout', now(), '2025-06-01T12:00Z', 'stats-a@example.test', 'Me', '', 1, true),
    ('6b1b0000-0000-4000-8000-000000000106', '6b1b0000-0000-4000-8000-0000000000a1', 'a6', 'a6', 'takeout', now(), '2025-07-01T12:00Z', 'friend@mail.example', NULL, '', 1, false),
    -- B's mail never counts for A.
    ('6b1b0000-0000-4000-8000-000000000201', '6b1b0000-0000-4000-8000-0000000000b1', 'b1', 'b1', 'takeout', now(), '2025-03-01T12:00Z', 'bill@power.example', 'Power', '', 1, false);
INSERT INTO minerva.mail_message_labels (message_id, label_id) VALUES
    ('6b1b0000-0000-4000-8000-000000000101', '6b1b0000-0000-4000-8000-0000000001a1'),
    ('6b1b0000-0000-4000-8000-000000000102', '6b1b0000-0000-4000-8000-0000000001a1'),
    ('6b1b0000-0000-4000-8000-000000000103', '6b1b0000-0000-4000-8000-0000000001a1'),
    ('6b1b0000-0000-4000-8000-000000000103', '6b1b0000-0000-4000-8000-0000000001a3'),
    ('6b1b0000-0000-4000-8000-000000000104', '6b1b0000-0000-4000-8000-0000000001a2'),
    ('6b1b0000-0000-4000-8000-000000000105', '6b1b0000-0000-4000-8000-0000000001a2'),
    -- a6 has only a category: unlabelled.
    ('6b1b0000-0000-4000-8000-000000000106', '6b1b0000-0000-4000-8000-0000000001a3'),
    ('6b1b0000-0000-4000-8000-000000000201', '6b1b0000-0000-4000-8000-0000000001b1');

-- Summary, all time and all mail.
SELECT pg_temp.expect('summary, all',
    (SELECT (messages, labels_in_use, senders, unlabelled) = (6::bigint, 2::bigint, 4::bigint, 1::bigint)
       AND first_received_at = '2024-03-01T12:00Z' AND last_received_at = '2025-07-01T12:00Z'
     FROM minerva.mail_statistics_summary('6b1b0000-0000-4000-8000-000000000001', NULL, 'all')));
-- Scope and range.
SELECT pg_temp.expect('summary, received',
    (SELECT messages = 5 FROM minerva.mail_statistics_summary('6b1b0000-0000-4000-8000-000000000001', NULL, 'received')));
SELECT pg_temp.expect('summary, sent',
    (SELECT messages = 1 AND senders = 1 FROM minerva.mail_statistics_summary('6b1b0000-0000-4000-8000-000000000001', NULL, 'sent')));
SELECT pg_temp.expect('summary, since 2025',
    (SELECT messages = 5 FROM minerva.mail_statistics_summary('6b1b0000-0000-4000-8000-000000000001', '2025-01-01T00:00Z', 'all')));
-- An empty range still answers one row of zeros.
SELECT pg_temp.expect('summary, nothing in range',
    (SELECT messages = 0 AND unlabelled = 0 AND first_received_at IS NULL
     FROM minerva.mail_statistics_summary('6b1b0000-0000-4000-8000-000000000001', '2030-01-01T00:00Z', 'all')));

-- Top senders: by count, ties by address, the latest name kept.
SELECT pg_temp.expect('top senders',
    (SELECT array_agg(address || ':' || messages ORDER BY ordinality)
     FROM minerva.mail_top_senders('6b1b0000-0000-4000-8000-000000000001', NULL, 'all', 3) WITH ORDINALITY)
    = ARRAY['bill@power.example:3', 'friend@mail.example:1', 'orders@shop.example:1']);
SELECT pg_temp.expect('top senders, limit',
    (SELECT count(*) = 1 FROM minerva.mail_top_senders('6b1b0000-0000-4000-8000-000000000001', NULL, 'all', 1)));

-- Top labels: user labels only, with distinct senders.
SELECT pg_temp.expect('top labels',
    (SELECT array_agg(name || ':' || messages || ':' || senders ORDER BY ordinality)
     FROM minerva.mail_top_labels('6b1b0000-0000-4000-8000-000000000001', NULL, 'all', 10) WITH ORDINALITY)
    = ARRAY['Bills/Power:3:1', 'Shopping:2:2']);
SELECT pg_temp.expect('top labels, received',
    (SELECT array_agg(name || ':' || messages ORDER BY ordinality)
     FROM minerva.mail_top_labels('6b1b0000-0000-4000-8000-000000000001', NULL, 'received', 10) WITH ORDINALITY)
    = ARRAY['Bills/Power:3', 'Shopping:1']);

-- By year, for the top senders and labels only.
SELECT pg_temp.expect('sender years',
    (SELECT array_agg(address || ':' || year || ':' || messages ORDER BY address, year)
     FROM minerva.mail_sender_years('6b1b0000-0000-4000-8000-000000000001', NULL, 'all', 1))
    = ARRAY['bill@power.example:2024:1', 'bill@power.example:2025:2']);
SELECT pg_temp.expect('label years',
    (SELECT array_agg(name || ':' || year || ':' || messages ORDER BY name, year)
     FROM minerva.mail_label_years('6b1b0000-0000-4000-8000-000000000001', NULL, 'all', 2))
    = ARRAY['Bills/Power:2024:1', 'Bills/Power:2025:2', 'Shopping:2025:2']);

-- B sees only B's.
SELECT pg_temp.expect('another user',
    (SELECT messages = 1 FROM minerva.mail_statistics_summary('6b1b0000-0000-4000-8000-000000000002', NULL, 'all')));

ROLLBACK;
