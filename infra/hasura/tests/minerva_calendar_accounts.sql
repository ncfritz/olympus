-- Checks for minerva.calendar_accounts, calendar_account_connections,
-- calendar_account_claims and meetings.account_id (migration
-- 1791110000000_minerva_calendar_accounts). Runs in a transaction that is
-- rolled back, so it is safe on any database with the migrations applied:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_calendar_accounts.sql <database>

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
END;
$$;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('7c3d0c6e-0000-4000-8000-000000000001', 'Account Check A', 'account-check-a@example.test'),
    ('7c3d0c6e-0000-4000-8000-0000000000ff', 'Account Check B', 'account-check-b@example.test');

-- An account the agent holds, owned by no one yet; then proven A's.
INSERT INTO minerva.calendar_accounts (id, provider, subject, email) VALUES
    ('7c3d0c6e-1000-4000-8000-000000000001', 'google', 'google-sub-1', 'a@example.test');
UPDATE minerva.calendar_accounts
    SET user_id = '7c3d0c6e-0000-4000-8000-000000000001', verified_at = now(), verification_method = 'sign_in'
    WHERE id = '7c3d0c6e-1000-4000-8000-000000000001';

-- One row per provider and subject; the same subject at another provider is another account.
SELECT pg_temp.expect_refused('the same account twice',
    $q$INSERT INTO minerva.calendar_accounts (provider, subject, email) VALUES ('google', 'google-sub-1', 'renamed@example.test')$q$, '23505');
INSERT INTO minerva.calendar_accounts (provider, subject, email) VALUES ('microsoft', 'google-sub-1', 'a@example.test');

SELECT pg_temp.expect_refused('an unknown provider',
    $q$INSERT INTO minerva.calendar_accounts (provider, subject, email) VALUES ('yahoo', 's', 'e')$q$, '23514');
SELECT pg_temp.expect_refused('an owner without proof',
    $q$INSERT INTO minerva.calendar_accounts (provider, subject, email, user_id) VALUES ('google', 's2', 'e', '7c3d0c6e-0000-4000-8000-000000000001')$q$, '23514');
SELECT pg_temp.expect_refused('proof without an owner',
    $q$INSERT INTO minerva.calendar_accounts (provider, subject, email, verified_at, verification_method) VALUES ('google', 's3', 'e', now(), 'consent')$q$, '23514');
SELECT pg_temp.expect_refused('an unknown verification method',
    $q$INSERT INTO minerva.calendar_accounts (provider, subject, email, user_id, verified_at, verification_method) VALUES ('google', 's4', 'e', '7c3d0c6e-0000-4000-8000-000000000001', now(), 'trust_me')$q$, '23514');

-- Connections: one per state.
INSERT INTO minerva.calendar_account_connections (user_id, provider, state_hash, code_verifier, return_to, expires_at) VALUES
    ('7c3d0c6e-0000-4000-8000-000000000001', 'google', 'hash-1', 'verifier', 'https://site/minerva/calendars', now() + interval '10 minutes');
SELECT pg_temp.expect_refused('a state used twice',
    $q$INSERT INTO minerva.calendar_account_connections (user_id, provider, state_hash, code_verifier, return_to, expires_at) VALUES ('7c3d0c6e-0000-4000-8000-0000000000ff', 'google', 'hash-1', 'v', 'r', now())$q$, '23505');

-- Claims: at most one open per account; a closed one does not count.
INSERT INTO minerva.calendar_account_claims (account_id, user_id, token_hash, expires_at, cancelled_at) VALUES
    ('7c3d0c6e-1000-4000-8000-000000000001', '7c3d0c6e-0000-4000-8000-0000000000ff', 'token-0', now(), now());
INSERT INTO minerva.calendar_account_claims (account_id, user_id, token_hash, expires_at) VALUES
    ('7c3d0c6e-1000-4000-8000-000000000001', '7c3d0c6e-0000-4000-8000-0000000000ff', 'token-1', now() + interval '1 day');
SELECT pg_temp.expect_refused('a second open claim',
    $q$INSERT INTO minerva.calendar_account_claims (account_id, user_id, token_hash, expires_at) VALUES ('7c3d0c6e-1000-4000-8000-000000000001', '7c3d0c6e-0000-4000-8000-000000000001', 'token-2', now())$q$, '23505');
SELECT pg_temp.expect_refused('a claim both confirmed and cancelled',
    $q$UPDATE minerva.calendar_account_claims SET confirmed_at = now(), cancelled_at = now() WHERE token_hash = 'token-1'$q$, '23514');

-- A meeting names its account; the account going leaves the meeting.
INSERT INTO minerva.meetings (id, user_id, account_id, subject, sensitivity, occurrence_type, type, reminder,
        start_time, end_time, duration, all_day, cancelled, source) VALUES
    ('accounts-check:1', '7c3d0c6e-0000-4000-8000-000000000001', '7c3d0c6e-1000-4000-8000-000000000001',
        'x', 'normal', 'single', 'meeting', false, now(), now(), 0, false, false, 'accounts-check');

-- Audit times: an update moves updated_at and leaves created_at.
UPDATE minerva.calendar_accounts SET created_at = '2026-01-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z'
    WHERE id = '7c3d0c6e-1000-4000-8000-000000000001';
UPDATE minerva.calendar_accounts SET email = 'a2@example.test' WHERE id = '7c3d0c6e-1000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.calendar_accounts WHERE id = '7c3d0c6e-1000-4000-8000-000000000001'
            AND (created_at <> '2026-01-01T00:00:00Z' OR updated_at = '2026-01-01T00:00:00Z')) THEN
        RAISE EXCEPTION 'calendar_accounts audit times wrong on update';
    END IF;
END;
$$;

DELETE FROM minerva.calendar_accounts WHERE id = '7c3d0c6e-1000-4000-8000-000000000001';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM minerva.meetings WHERE id = 'accounts-check:1' AND account_id IS NULL) THEN
        RAISE EXCEPTION 'removing an account did not leave its meeting, account cleared';
    END IF;
    IF EXISTS (SELECT 1 FROM minerva.calendar_account_claims WHERE token_hash = 'token-1') THEN
        RAISE EXCEPTION 'removing an account left its claims';
    END IF;
END;
$$;

-- Deleting a user removes their accounts, sign-ins and claims.
DELETE FROM olympus.users WHERE id = '7c3d0c6e-0000-4000-8000-000000000001';
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM minerva.calendar_account_connections WHERE state_hash = 'hash-1') THEN
        RAISE EXCEPTION 'deleting a user left their sign-ins';
    END IF;
END;
$$;

ROLLBACK;
