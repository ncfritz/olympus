-- Keeping a linked mailbox in step with Gmail (docs/plans/email-management
-- phase 1b), and one correction.
--
-- The correction: 1791260000000 recorded a linked account's Google subject
-- in a new google_subject column, but mail_accounts has had `subject`, for
-- exactly that, unique per provider, since 1791200000000. The subject moves
-- there and google_subject goes.
--
-- Sync: the reconcile records Gmail's historyId, from which history polling
-- carries on, and Gmail's own totals for the mailbox (getProfile), which M2
-- compares with Minerva's.

UPDATE minerva.mail_accounts SET subject = google_subject WHERE google_subject IS NOT NULL;
ALTER TABLE minerva.mail_accounts
    DROP CONSTRAINT mail_accounts_linked_check,
    DROP CONSTRAINT mail_accounts_google_subject_key,
    DROP COLUMN google_subject,
    ADD CONSTRAINT mail_accounts_linked_check CHECK (
        (subject IS NULL) = (linked_at IS NULL)
        AND (subject IS NULL) = (link_scope IS NULL)
    ),
    ADD COLUMN history_id text,
    ADD COLUMN synced_at timestamp with time zone,
    ADD COLUMN gmail_messages_total integer,
    ADD COLUMN gmail_threads_total integer,
    ADD CONSTRAINT mail_accounts_history_id_check CHECK (history_id IS NULL OR history_id ~ '^[0-9]{1,20}$'),
    ADD CONSTRAINT mail_accounts_synced_check CHECK (
        (history_id IS NULL) = (synced_at IS NULL)
        AND (gmail_messages_total IS NULL OR gmail_messages_total >= 0)
        AND (gmail_threads_total IS NULL OR gmail_threads_total >= 0)
    );
