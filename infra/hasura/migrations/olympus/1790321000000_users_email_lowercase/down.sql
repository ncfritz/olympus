ALTER TABLE olympus.user_identities
    DROP CONSTRAINT IF EXISTS user_identities_email_lowercase;

ALTER TABLE olympus.users
    DROP CONSTRAINT IF EXISTS users_email_lowercase;
