-- Addresses as senders write them, not as RFC 5321 limits them: bulk mail
-- puts tracking tokens in Reply-To local parts of 300 characters and more,
-- which Gmail accepts. 1,024 holds those; the mail account's own address,
-- a real mailbox, keeps 320.
ALTER TABLE minerva.mail_message_recipients
    DROP CONSTRAINT mail_message_recipients_address_check,
    ADD CONSTRAINT mail_message_recipients_address_check
        CHECK (address = lower(address) AND length(address) BETWEEN 1 AND 1024);
