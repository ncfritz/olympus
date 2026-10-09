ALTER TABLE minerva.mail_message_recipients
    DROP CONSTRAINT mail_message_recipients_address_check,
    ADD CONSTRAINT mail_message_recipients_address_check
        CHECK (address = lower(address) AND length(address) BETWEEN 1 AND 320);
