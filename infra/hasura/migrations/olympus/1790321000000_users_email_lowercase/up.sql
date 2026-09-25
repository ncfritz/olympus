-- Addresses are stored lowercased, and the database insists.
--
-- The lookup that links an identity to a user on first sign-in is by email,
-- and it has to be exact. Hasura can express `_eq` and `_ilike` but not
-- `lower(email) = lower($1)`, and `_ilike` treats `_` and `%` as wildcards —
-- an underscore is ordinary in an address, so `a_b@example.com` would match
-- `axb@example.com` and hand someone another user's account.
--
-- So the comparison is equality against a lowercased input, which is only
-- correct if what is stored is lowercase. A CHECK makes that true rather
-- than hoped for: a mixed-case insert fails loudly instead of creating a row
-- that can never be found.
--
-- The unique index over lower(email) stays. It is now redundant with this,
-- and harmless.

ALTER TABLE olympus.users
    ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email));

ALTER TABLE olympus.user_identities
    ADD CONSTRAINT user_identities_email_lowercase CHECK (email = lower(email));
