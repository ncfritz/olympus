ALTER TABLE minerva.mail_accounts
    DROP CONSTRAINT mail_accounts_synced_check,
    DROP CONSTRAINT mail_accounts_history_id_check,
    DROP COLUMN gmail_threads_total,
    DROP COLUMN gmail_messages_total,
    DROP COLUMN synced_at,
    DROP COLUMN history_id,
    DROP CONSTRAINT mail_accounts_linked_check,
    ADD COLUMN google_subject text,
    ADD CONSTRAINT mail_accounts_google_subject_key UNIQUE (google_subject);
UPDATE minerva.mail_accounts SET google_subject = subject WHERE linked_at IS NOT NULL;
UPDATE minerva.mail_accounts SET subject = NULL WHERE linked_at IS NOT NULL;
ALTER TABLE minerva.mail_accounts
    ADD CONSTRAINT mail_accounts_linked_check CHECK (
        (google_subject IS NULL) = (linked_at IS NULL)
        AND (google_subject IS NULL) = (link_scope IS NULL)
    );
