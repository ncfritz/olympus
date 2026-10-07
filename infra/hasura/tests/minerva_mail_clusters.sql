-- Checks for migration 1791340000000_minerva_mail_clusters. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_clusters.sql <database>

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
    ('9c9c0000-0000-4000-8000-000000000001', 'Clusters', 'clusters@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('9c9c0000-0000-4000-8000-0000000000a1', '9c9c0000-0000-4000-8000-000000000001', 'clusters@example.test', now(), 'import');
INSERT INTO minerva.mail_labels (id, account_id, name, type) VALUES
    ('9c9c0000-0000-4000-8000-0000000000c1', '9c9c0000-0000-4000-8000-0000000000a1', 'Travel', 'user');
INSERT INTO minerva.mail_messages (id, account_id, gmail_id, thread_id, source, snapshot_time, received_at,
                                   snippet, size_bytes) VALUES
    ('9c9c0000-0000-4000-8000-0000000000e1', '9c9c0000-0000-4000-8000-0000000000a1', 'e1', 'e1', 'gmail', now(), now(), '', 1),
    ('9c9c0000-0000-4000-8000-0000000000e2', '9c9c0000-0000-4000-8000-0000000000a1', 'e2', 'e2', 'gmail', now(), now(), '', 1);
INSERT INTO minerva.mail_cluster_runs (id, account_id, embedding_version) VALUES
    ('9c9c0000-0000-4000-8000-0000000000b1', '9c9c0000-0000-4000-8000-0000000000a1', 'nomic-embed-text-384');
INSERT INTO minerva.mail_clusters (id, run_id, number, scope, scope_label_id, name, size, purity, x, y, suggestion, proposed_name) VALUES
    ('9c9c0000-0000-4000-8000-0000000000d1', '9c9c0000-0000-4000-8000-0000000000b1', 0, 'unlabelled', NULL,
     'Mail from shop.example', 40, 0, 0.2, 0.3, 'new-label', 'Shop'),
    ('9c9c0000-0000-4000-8000-0000000000d2', '9c9c0000-0000-4000-8000-0000000000b1', 1, 'label',
     '9c9c0000-0000-4000-8000-0000000000c1', 'Travel: air.example', 30, 1, 0.7, 0.6, 'split', 'Travel/Air');
INSERT INTO minerva.mail_cluster_labels (cluster_id, label_id, messages) VALUES
    ('9c9c0000-0000-4000-8000-0000000000d2', '9c9c0000-0000-4000-8000-0000000000c1', 30);
INSERT INTO minerva.mail_cluster_senders (cluster_id, sender, messages) VALUES
    ('9c9c0000-0000-4000-8000-0000000000d1', 'orders@shop.example', 38);
INSERT INTO minerva.mail_cluster_members (cluster_id, message_id) VALUES
    ('9c9c0000-0000-4000-8000-0000000000d1', '9c9c0000-0000-4000-8000-0000000000e1');
INSERT INTO minerva.mail_cluster_points (run_id, message_id, x, y, cluster_id) VALUES
    ('9c9c0000-0000-4000-8000-0000000000b1', '9c9c0000-0000-4000-8000-0000000000e1', 0.2, 0.3,
     '9c9c0000-0000-4000-8000-0000000000d1'),
    ('9c9c0000-0000-4000-8000-0000000000b1', '9c9c0000-0000-4000-8000-0000000000e2', 0.9, 0.1, NULL);

SELECT pg_temp.expect('a run holds its clusters and its map',
    (SELECT count(*) = 2 FROM minerva.mail_clusters WHERE run_id = '9c9c0000-0000-4000-8000-0000000000b1')
    AND (SELECT count(*) = 2 FROM minerva.mail_cluster_points WHERE run_id = '9c9c0000-0000-4000-8000-0000000000b1'));
SELECT pg_temp.expect_refused('a split is of a label''s cluster',
    $q$INSERT INTO minerva.mail_clusters (run_id, number, scope, name, size, purity, x, y, suggestion, proposed_name)
       VALUES ('9c9c0000-0000-4000-8000-0000000000b1', 2, 'unlabelled', 'x', 1, 0, 0, 0, 'split', 'Travel/X')$q$, '23514');
SELECT pg_temp.expect_refused('a suggestion names its label',
    $q$INSERT INTO minerva.mail_clusters (run_id, number, scope, name, size, purity, x, y, suggestion)
       VALUES ('9c9c0000-0000-4000-8000-0000000000b1', 3, 'unlabelled', 'x', 1, 0, 0, 0, 'new-label')$q$, '23514');
SELECT pg_temp.expect_refused('unlabelled mail has no label',
    $q$INSERT INTO minerva.mail_clusters (run_id, number, scope, scope_label_id, name, size, purity, x, y)
       VALUES ('9c9c0000-0000-4000-8000-0000000000b1', 4, 'unlabelled', '9c9c0000-0000-4000-8000-0000000000c1', 'x', 1, 0, 0, 0)$q$, '23514');
SELECT pg_temp.expect_refused('a cluster number once per run',
    $q$INSERT INTO minerva.mail_clusters (run_id, number, scope, name, size, purity, x, y)
       VALUES ('9c9c0000-0000-4000-8000-0000000000b1', 0, 'unlabelled', 'x', 1, 0, 0, 0)$q$, '23505');
SELECT pg_temp.expect_refused('the map is a unit square',
    $q$INSERT INTO minerva.mail_cluster_points (run_id, message_id, x, y)
       VALUES ('9c9c0000-0000-4000-8000-0000000000b1', '9c9c0000-0000-4000-8000-0000000000e1', 1.5, 0)$q$, '23514');
SELECT pg_temp.expect_refused('a ready run says how many it clustered',
    $q$UPDATE minerva.mail_cluster_runs SET status = 'ready', finished_at = now()
       WHERE id = '9c9c0000-0000-4000-8000-0000000000b1'$q$, '23514');

DELETE FROM minerva.mail_labels WHERE id = '9c9c0000-0000-4000-8000-0000000000c1';
SELECT pg_temp.expect('a label''s clusters go with it',
    (SELECT count(*) = 1 FROM minerva.mail_clusters WHERE run_id = '9c9c0000-0000-4000-8000-0000000000b1'));
DELETE FROM minerva.mail_cluster_runs WHERE id = '9c9c0000-0000-4000-8000-0000000000b1';
SELECT pg_temp.expect('everything goes with its run',
    (SELECT count(*) = 0 FROM minerva.mail_clusters)
    AND (SELECT count(*) = 0 FROM minerva.mail_cluster_members)
    AND (SELECT count(*) = 0 FROM minerva.mail_cluster_points));

ROLLBACK;
