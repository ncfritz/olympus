-- The email a user is found by, as a column the database computes.
--
-- Linking a provider identity on first sign-in is a lookup by email, and it
-- has to be exact. Hasura can express `_eq` and `_ilike` but not
-- `lower(email) = lower($1)`, and `_ilike` treats `_` as a wildcard — an
-- underscore is ordinary in an address, so `a_b@example.com` would match
-- `axb@example.com` and hand someone another user's account.
--
-- So the comparison key is its own column, generated. Not a CHECK that
-- `email = lower(email)`, which would throw away the casing someone typed;
-- and not a hash, which only moves normalization to every writer while
-- making a mis-normalized row impossible to spot. Generated means no writer
-- can get it wrong and there is nothing to remember.
--
-- `btrim` as well as `lower`, because a stray space is the other way an
-- address arrives not quite matching itself.
--
-- user_identities.email is deliberately left alone: it records the address
-- at link time for the audit trail and is never a lookup key.

ALTER TABLE olympus.users
    ADD COLUMN email_normalized text
    GENERATED ALWAYS AS (lower(btrim(email))) STORED;

CREATE UNIQUE INDEX users_email_normalized_key
    ON olympus.users USING btree (email_normalized);

-- Redundant now: the generated column is unique, and it is the one anything
-- searches on.
DROP INDEX IF EXISTS olympus.users_email_key;
