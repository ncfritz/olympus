DROP TABLE minerva.mail_account_connections;
ALTER TABLE minerva.mail_accounts
    DROP CONSTRAINT mail_accounts_google_subject_key,
    DROP CONSTRAINT mail_accounts_linked_check,
    DROP COLUMN link_scope,
    DROP COLUMN linked_at,
    DROP COLUMN google_subject;
