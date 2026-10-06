-- Checks for migration 1791230000000_minerva_mail_audit. Runs in a
-- transaction that is rolled back, so it is safe on any database with the
-- migrations applied, and fails loudly on the first wrong answer:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_audit.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

CREATE FUNCTION pg_temp.expect(label text, ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    IF ok IS NOT TRUE THEN RAISE EXCEPTION '%: wrong', label; END IF;
END $$;

-- Messages from `sender`, `n` of them, numbered from `first`, each with
-- `label` (and in thread `thread` if given), received a day apart.
CREATE FUNCTION pg_temp.mail(account uuid, sender text, first integer, n integer, label uuid,
                             thread text DEFAULT NULL, starred boolean DEFAULT false,
                             subject text DEFAULT NULL)
    RETURNS void LANGUAGE plpgsql AS $$
DECLARE i integer; mid uuid;
BEGIN
    FOR i IN first .. first + n - 1 LOOP
        INSERT INTO minerva.mail_messages
            (account_id, gmail_id, thread_id, source, snapshot_time, received_at, from_address, snippet, size_bytes, starred, subject)
        VALUES (account, to_hex(i), coalesce(thread, to_hex(i)), 'takeout', now(),
                timestamptz '2024-01-01' + i * interval '1 day', sender, '', 1, starred,
                CASE WHEN subject IS NULL THEN NULL ELSE replace(subject, '#', i::text) END)
        RETURNING id INTO mid;
        IF label IS NOT NULL THEN
            INSERT INTO minerva.mail_message_labels (message_id, label_id) VALUES (mid, label);
        END IF;
    END LOOP;
END $$;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('6c1c0000-0000-4000-8000-000000000001', 'Audit A', 'audit-a@example.test'),
    ('6c1c0000-0000-4000-8000-000000000002', 'Audit B', 'audit-b@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('6c1c0000-0000-4000-8000-0000000000a1', '6c1c0000-0000-4000-8000-000000000001', 'audit-a@example.test', now(), 'import'),
    ('6c1c0000-0000-4000-8000-0000000000b1', '6c1c0000-0000-4000-8000-000000000002', 'audit-b@example.test', now(), 'import');
INSERT INTO minerva.mail_labels (id, account_id, name) VALUES
    ('6c1c0000-0000-4000-8000-000000000101', '6c1c0000-0000-4000-8000-0000000000a1', 'Bills/Power'),
    ('6c1c0000-0000-4000-8000-000000000102', '6c1c0000-0000-4000-8000-0000000000a1', 'Shopping'),
    ('6c1c0000-0000-4000-8000-000000000103', '6c1c0000-0000-4000-8000-0000000000a1', 'Advertisements'),
    ('6c1c0000-0000-4000-8000-000000000104', '6c1c0000-0000-4000-8000-0000000000a1', 'Accounts/Advertisements'),
    ('6c1c0000-0000-4000-8000-000000000105', '6c1c0000-0000-4000-8000-0000000000a1', 'Deals'),
    ('6c1c0000-0000-4000-8000-000000000106', '6c1c0000-0000-4000-8000-0000000000a1', 'Offers'),
    ('6c1c0000-0000-4000-8000-000000000107', '6c1c0000-0000-4000-8000-0000000000a1', 'Travel'),
    ('6c1c0000-0000-4000-8000-000000000108', '6c1c0000-0000-4000-8000-0000000000a1', 'Travel/Flights'),
    ('6c1c0000-0000-4000-8000-0000000001b1', '6c1c0000-0000-4000-8000-0000000000b1', 'Bills/Power');

-- Power: 27 under Bills/Power, 2 under Shopping (strays), 1 unlabelled.
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'bill@power.example', 1, 27, '6c1c0000-0000-4000-8000-000000000101');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'bill@power.example', 28, 2, '6c1c0000-0000-4000-8000-000000000102');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'bill@power.example', 30, 1, NULL);
-- Four messages are too few to call a sender consistent.
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'few@shop.example', 40, 3, '6c1c0000-0000-4000-8000-000000000102');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'few@shop.example', 43, 1, NULL);
-- A thread whose two messages disagree, and one whose two agree.
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'friend@mail.example', 50, 1, '6c1c0000-0000-4000-8000-000000000102', 'aa');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'friend@mail.example', 51, 1, '6c1c0000-0000-4000-8000-000000000107', 'aa');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'friend@mail.example', 52, 2, '6c1c0000-0000-4000-8000-000000000102', 'bb');
-- Advertisements (12) and Accounts/Advertisements (20): a duplicated root.
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'ads1@promo.example', 100, 6, '6c1c0000-0000-4000-8000-000000000103');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'ads2@promo.example', 106, 6, '6c1c0000-0000-4000-8000-000000000103');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'ads9@promo.example', 120, 20, '6c1c0000-0000-4000-8000-000000000104');
-- Deals (12, three senders) and Offers (20, the same three and one more).
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'a@deal.example', 200, 4, '6c1c0000-0000-4000-8000-000000000105');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'b@deal.example', 204, 4, '6c1c0000-0000-4000-8000-000000000105');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'c@deal.example', 208, 4, '6c1c0000-0000-4000-8000-000000000105');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'a@deal.example', 220, 5, '6c1c0000-0000-4000-8000-000000000106');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'b@deal.example', 225, 5, '6c1c0000-0000-4000-8000-000000000106');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'c@deal.example', 230, 5, '6c1c0000-0000-4000-8000-000000000106');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'd@deal.example', 235, 5, '6c1c0000-0000-4000-8000-000000000106');
-- Travel and Travel/Flights share senders, as a parent and child do.
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'a@air.example', 300, 4, '6c1c0000-0000-4000-8000-000000000107');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'b@air.example', 304, 4, '6c1c0000-0000-4000-8000-000000000107');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'c@air.example', 308, 4, '6c1c0000-0000-4000-8000-000000000107');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'a@air.example', 320, 4, '6c1c0000-0000-4000-8000-000000000108');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'b@air.example', 324, 4, '6c1c0000-0000-4000-8000-000000000108');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'c@air.example', 328, 4, '6c1c0000-0000-4000-8000-000000000108');
-- B's mail, the same shape as A's power bills.
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000b1', 'bill@power.example', 500, 9, '6c1c0000-0000-4000-8000-0000000001b1');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000b1', 'bill@power.example', 509, 1, NULL);

-- Stars: a monthly bill, starred some months and not others.
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'bill@water.example', 400, 2, NULL, NULL, true, 'Your bill #');
SELECT pg_temp.mail('6c1c0000-0000-4000-8000-0000000000a1', 'bill@water.example', 402, 3, NULL, NULL, false, 'Your bill #');

SELECT pg_temp.expect('one run for A',
    (SELECT count(*) = 1 FROM minerva.mail_run_audit('6c1c0000-0000-4000-8000-000000000001')));

CREATE TEMP VIEW changes AS
    SELECT c.action, l.name AS label, m.from_address, c.confidence, c.sender_messages, c.sender_label_messages
    FROM minerva.mail_audit_changes c
    JOIN minerva.mail_audit_runs r ON r.id = c.run_id AND r.account_id = '6c1c0000-0000-4000-8000-0000000000a1'
    JOIN minerva.mail_labels l ON l.id = c.label_id
    JOIN minerva.mail_messages m ON m.id = c.message_id;

-- Power's three strays get Bills/Power, at its 27 of 30.
SELECT pg_temp.expect('power: add',
    (SELECT count(*) = 3 AND bool_and(confidence = 0.900 AND sender_messages = 30 AND sender_label_messages = 27)
     FROM changes WHERE from_address = 'bill@power.example' AND action = 'add' AND label = 'Bills/Power'));
-- Shopping, on 2 of 30 of Power's, is proposed off them.
SELECT pg_temp.expect('power: remove',
    (SELECT count(*) = 2 AND bool_and(confidence = 0.933 AND sender_label_messages = 2)
     FROM changes WHERE from_address = 'bill@power.example' AND action = 'remove' AND label = 'Shopping'));
SELECT pg_temp.expect('a sender of four is left alone',
    (SELECT count(*) = 0 FROM changes WHERE from_address = 'few@shop.example'));
SELECT pg_temp.expect('nothing else for power',
    (SELECT count(*) = 5 FROM changes WHERE from_address = 'bill@power.example'));

-- Threads: the disagreeing one only.
SELECT pg_temp.expect('mixed thread',
    (SELECT array_agg(thread_id || ':' || messages || ':' || label_sets)
     FROM minerva.mail_audit_threads t
     JOIN minerva.mail_audit_runs r ON r.id = t.run_id AND r.account_id = '6c1c0000-0000-4000-8000-0000000000a1')
    = ARRAY['aa:2:2']);

-- Merges: the duplicated root, smaller into larger, and Deals into Offers;
-- not Travel and Travel/Flights.
CREATE TEMP VIEW merges AS
    SELECT f.name AS from_label, i.name AS into_label, g.reason, g.shared_senders, g.from_senders,
           g.sender_overlap, g.from_messages, g.into_messages
    FROM minerva.mail_audit_merges g
    JOIN minerva.mail_audit_runs r ON r.id = g.run_id AND r.account_id = '6c1c0000-0000-4000-8000-0000000000a1'
    JOIN minerva.mail_labels f ON f.id = g.from_label_id
    JOIN minerva.mail_labels i ON i.id = g.into_label_id;
SELECT pg_temp.expect('duplicated root',
    (SELECT reason = 'same_leaf' AND from_messages = 12 AND into_messages = 20 AND shared_senders = 0
     FROM merges WHERE from_label = 'Advertisements' AND into_label = 'Accounts/Advertisements'));
SELECT pg_temp.expect('sender overlap',
    (SELECT reason = 'sender_overlap' AND shared_senders = 3 AND from_senders = 3 AND sender_overlap = 1
     FROM merges WHERE from_label = 'Deals' AND into_label = 'Offers'));
SELECT pg_temp.expect('no parent and child',
    (SELECT count(*) = 0 FROM merges WHERE from_label LIKE 'Travel%' OR into_label LIKE 'Travel%'));
SELECT pg_temp.expect('two merges in all', (SELECT count(*) = 2 FROM merges));

-- The run's counts.
SELECT pg_temp.expect('run counts',
    (SELECT messages_examined = 131 AND consistent_senders >= 1 AND finished_at >= started_at
     FROM minerva.mail_audit_runs WHERE account_id = '6c1c0000-0000-4000-8000-0000000000a1'));

-- A second run replaces the first; B's account is untouched by A's.
SELECT pg_temp.expect('rerun',
    (SELECT count(*) = 1 FROM minerva.mail_run_audit('6c1c0000-0000-4000-8000-000000000001')));
SELECT pg_temp.expect('one run kept',
    (SELECT count(*) = 1 FROM minerva.mail_audit_runs WHERE account_id = '6c1c0000-0000-4000-8000-0000000000a1'));
SELECT pg_temp.expect('changes not doubled',
    (SELECT count(*) = 5 FROM changes WHERE from_address = 'bill@power.example'));
SELECT pg_temp.expect('B not run',
    (SELECT count(*) = 0 FROM minerva.mail_audit_runs WHERE account_id = '6c1c0000-0000-4000-8000-0000000000b1'));

-- The page's summary and label rows.
SELECT pg_temp.expect('audit summary',
    (SELECT changes = 5 AND additions = 3 AND removals = 2 AND merges = 2 AND threads = 1
            AND high_confidence = 5 AND messages_affected = 3 AND messages_examined = 131
     FROM minerva.mail_audit_summary('6c1c0000-0000-4000-8000-000000000001', 0.9)));
SELECT pg_temp.expect('no summary without a run',
    (SELECT count(*) = 0 FROM minerva.mail_audit_summary('6c1c0000-0000-4000-8000-000000000002', 0.9)));
SELECT pg_temp.expect('label rows',
    (SELECT array_agg(name || ':' || messages || ':' || proposed_in || ':' || proposed_out || ':' || merge_candidate ORDER BY name)
     FROM minerva.mail_audit_labels('6c1c0000-0000-4000-8000-000000000001', 0.9)
     WHERE name IN ('Bills/Power', 'Shopping', 'Deals', 'Travel'))
    = ARRAY['Bills/Power:27:3:0:false', 'Deals:12:0:0:true', 'Shopping:8:0:2:false', 'Travel:13:0:0:false']);
SELECT pg_temp.expect('every label, even unused',
    (SELECT count(*) = 8 FROM minerva.mail_audit_labels('6c1c0000-0000-4000-8000-000000000001', 0.9)));

-- Stars.
SELECT pg_temp.expect('star ages',
    (SELECT array_agg(age || ':' || starred) FROM minerva.mail_star_ages('6c1c0000-0000-4000-8000-000000000001'))
    = ARRAY['month:0', 'year:0', 'older:2']);
SELECT pg_temp.expect('star senders',
    (SELECT array_agg(address || ':' || messages || ':' || starred)
     FROM minerva.mail_star_senders('6c1c0000-0000-4000-8000-000000000001', 5))
    = ARRAY['bill@water.example:5:2']);
SELECT pg_temp.expect('star mixed',
    (SELECT array_agg(address || ':' || subject_pattern || ':' || messages || ':' || starred)
     FROM minerva.mail_star_mixed('6c1c0000-0000-4000-8000-000000000001', 5))
    = ARRAY['bill@water.example:your bill #:5:2']);
SELECT pg_temp.expect('star labels: none starred under a user label',
    (SELECT count(*) = 0 FROM minerva.mail_star_labels('6c1c0000-0000-4000-8000-000000000001', 5)));

ROLLBACK;
