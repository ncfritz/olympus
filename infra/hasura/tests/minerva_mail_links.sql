-- Checks for migration 1791260000000_minerva_mail_links. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_mail_links.sql <database>

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
    ('1c1c0000-0000-4000-8000-000000000001', 'Link A', 'link-a@example.test');
INSERT INTO minerva.mail_accounts (id, user_id, email, verified_at, verification_method) VALUES
    ('1c1c0000-0000-4000-8000-0000000000a1', '1c1c0000-0000-4000-8000-000000000001', 'link-a@example.test', now(), 'import'),
    ('1c1c0000-0000-4000-8000-0000000000a2', '1c1c0000-0000-4000-8000-000000000001', 'link-b@example.test', now(), 'import');

SELECT pg_temp.expect('an imported account is not linked',
    (SELECT google_subject IS NULL AND linked_at IS NULL
       FROM minerva.mail_accounts WHERE id = '1c1c0000-0000-4000-8000-0000000000a1'));

UPDATE minerva.mail_accounts
   SET google_subject = 'g-1', linked_at = now(), link_scope = 'openid email gmail.readonly'
 WHERE id = '1c1c0000-0000-4000-8000-0000000000a1';

SELECT pg_temp.expect_refused('a subject without when it was linked',
    $q$UPDATE minerva.mail_accounts SET google_subject = 'g-2'
       WHERE id = '1c1c0000-0000-4000-8000-0000000000a2'$q$, '23514');
SELECT pg_temp.expect_refused('one Google account is one mailbox',
    $q$UPDATE minerva.mail_accounts
          SET google_subject = 'g-1', linked_at = now(), link_scope = 'openid'
        WHERE id = '1c1c0000-0000-4000-8000-0000000000a2'$q$, '23505');

INSERT INTO minerva.mail_account_connections
    (user_id, account_id, state_hash, code_verifier, return_to, expires_at) VALUES
    ('1c1c0000-0000-4000-8000-000000000001', '1c1c0000-0000-4000-8000-0000000000a2',
     'hash-1', 'verifier', 'https://olympus.example.test/minerva/mail', now() + interval '10 minutes');
SELECT pg_temp.expect_refused('a state is used once',
    $q$INSERT INTO minerva.mail_account_connections
          (user_id, account_id, state_hash, code_verifier, return_to, expires_at)
       VALUES ('1c1c0000-0000-4000-8000-000000000001', '1c1c0000-0000-4000-8000-0000000000a2',
               'hash-1', 'v', 'https://x', now())$q$, '23505');

DELETE FROM minerva.mail_accounts WHERE id = '1c1c0000-0000-4000-8000-0000000000a2';
SELECT pg_temp.expect('an account takes its sign-ins with it',
    (SELECT count(*) = 0 FROM minerva.mail_account_connections));

ROLLBACK;
