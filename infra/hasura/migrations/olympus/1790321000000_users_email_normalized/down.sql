CREATE UNIQUE INDEX users_email_key ON olympus.users USING btree (lower(email));

DROP INDEX IF EXISTS olympus.users_email_normalized_key;

ALTER TABLE olympus.users DROP COLUMN IF EXISTS email_normalized;
