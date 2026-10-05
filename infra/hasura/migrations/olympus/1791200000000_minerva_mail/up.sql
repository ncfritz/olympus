-- Mail: a Gmail mailbox's labels and message metadata, each user's own
-- (ADR 0030, docs/plans/email-management phase 1a). No message body is
-- stored, only Gmail's snippet. The API scopes every read and write;
-- Hasura grants nothing beyond admin.

-- One mailbox. Imported from a Takeout archive it has no subject until it
-- is linked by consent (phase 1b), which must return the same address.
CREATE TABLE minerva.mail_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text DEFAULT 'google' NOT NULL,
    -- Google's sub, once linked.
    subject text,
    email text NOT NULL,
    verified_at timestamp with time zone NOT NULL,
    verification_method text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_accounts_provider_check CHECK (provider IN ('google')),
    CONSTRAINT mail_accounts_subject_check CHECK (subject IS NULL OR length(subject) BETWEEN 1 AND 300),
    CONSTRAINT mail_accounts_email_check CHECK (
        email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+$' AND length(email) <= 320
    ),
    CONSTRAINT mail_accounts_verification_method_check CHECK (
        verification_method IN ('import', 'consent')
    )
);

ALTER TABLE ONLY minerva.mail_accounts
    ADD CONSTRAINT mail_accounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_accounts
    ADD CONSTRAINT mail_accounts_provider_email_key UNIQUE (provider, email);
CREATE UNIQUE INDEX mail_accounts_provider_subject_key
    ON minerva.mail_accounts USING btree (provider, subject) WHERE subject IS NOT NULL;
ALTER TABLE ONLY minerva.mail_accounts
    ADD CONSTRAINT mail_accounts_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_accounts_user_id_idx ON minerva.mail_accounts USING btree (user_id);

CREATE TRIGGER set_minerva_mail_accounts_updated_at BEFORE UPDATE ON minerva.mail_accounts
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A label, by its full name as Gmail shows it (`Accounts/Utilities`), the
-- parent being the name up to the last `/`. User labels, and Gmail's
-- categories as system labels named as the API names them
-- (`CATEGORY_UPDATES`). Inbox, unread, starred, important and sent are
-- flags on the message instead. Gmail's ID arrives with linking (1b).
CREATE TABLE minerva.mail_labels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'user' NOT NULL,
    parent_name text GENERATED ALWAYS AS (
        CASE WHEN strpos(name, '/') > 0 THEN regexp_replace(name, '/[^/]*$', '') END
    ) STORED,
    gmail_label_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_labels_name_check CHECK (length(name) BETWEEN 1 AND 225 AND name = btrim(name)),
    CONSTRAINT mail_labels_type_check CHECK (type IN ('user', 'system'))
);

ALTER TABLE ONLY minerva.mail_labels
    ADD CONSTRAINT mail_labels_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_labels
    ADD CONSTRAINT mail_labels_account_id_name_key UNIQUE (account_id, name);
CREATE UNIQUE INDEX mail_labels_account_id_gmail_label_id_key
    ON minerva.mail_labels USING btree (account_id, gmail_label_id) WHERE gmail_label_id IS NOT NULL;
ALTER TABLE ONLY minerva.mail_labels
    ADD CONSTRAINT mail_labels_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER set_minerva_mail_labels_updated_at BEFORE UPDATE ON minerva.mail_labels
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A message's metadata, by Gmail's ID (hexadecimal, as the API writes
-- it). `snapshot_time` is when the source read it: a write older than
-- the row's is skipped, so a late or redriven message cannot undo a newer
-- one.
CREATE TABLE minerva.mail_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    gmail_id text NOT NULL,
    thread_id text NOT NULL,
    source text NOT NULL,
    snapshot_time timestamp with time zone NOT NULL,
    received_at timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    from_address text,
    from_name text,
    from_domain text GENERATED ALWAYS AS (
        CASE WHEN strpos(from_address, '@') > 0 THEN split_part(from_address, '@', 2) END
    ) STORED,
    delivered_to text,
    list_id text,
    has_list_unsubscribe boolean DEFAULT false NOT NULL,
    message_id_header text,
    subject text,
    snippet text NOT NULL,
    size_bytes integer NOT NULL,
    in_inbox boolean DEFAULT false NOT NULL,
    unread boolean DEFAULT false NOT NULL,
    starred boolean DEFAULT false NOT NULL,
    important boolean DEFAULT false NOT NULL,
    sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_messages_gmail_id_check CHECK (gmail_id ~ '^[0-9a-f]{1,16}$'),
    CONSTRAINT mail_messages_thread_id_check CHECK (thread_id ~ '^[0-9a-f]{1,16}$'),
    CONSTRAINT mail_messages_source_check CHECK (source IN ('takeout', 'gmail')),
    CONSTRAINT mail_messages_from_address_check CHECK (from_address IS NULL OR from_address = lower(from_address)),
    -- The one piece of a body kept (ADR 0030).
    CONSTRAINT mail_messages_snippet_check CHECK (char_length(snippet) <= 200),
    CONSTRAINT mail_messages_size_bytes_check CHECK (size_bytes >= 0)
);

ALTER TABLE ONLY minerva.mail_messages
    ADD CONSTRAINT mail_messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_messages
    ADD CONSTRAINT mail_messages_account_id_gmail_id_key UNIQUE (account_id, gmail_id);
ALTER TABLE ONLY minerva.mail_messages
    ADD CONSTRAINT mail_messages_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_messages_account_id_thread_id_idx ON minerva.mail_messages USING btree (account_id, thread_id);
CREATE INDEX mail_messages_account_id_received_at_idx ON minerva.mail_messages USING btree (account_id, received_at);
CREATE INDEX mail_messages_account_id_from_address_idx ON minerva.mail_messages USING btree (account_id, from_address);
CREATE INDEX mail_messages_account_id_from_domain_idx ON minerva.mail_messages USING btree (account_id, from_domain);
CREATE INDEX mail_messages_account_id_list_id_idx
    ON minerva.mail_messages USING btree (account_id, list_id) WHERE list_id IS NOT NULL;
CREATE INDEX mail_messages_inbox_idx
    ON minerva.mail_messages USING btree (account_id, received_at) WHERE in_inbox;

CREATE TRIGGER set_minerva_mail_messages_updated_at BEFORE UPDATE ON minerva.mail_messages
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- To, cc and reply-to addresses, in their order.
CREATE TABLE minerva.mail_message_recipients (
    message_id uuid NOT NULL,
    kind text NOT NULL,
    position smallint NOT NULL,
    address text NOT NULL,
    name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_message_recipients_kind_check CHECK (kind IN ('to', 'cc', 'reply_to')),
    CONSTRAINT mail_message_recipients_position_check CHECK (position >= 0),
    CONSTRAINT mail_message_recipients_address_check CHECK (address = lower(address) AND length(address) BETWEEN 1 AND 320)
);

ALTER TABLE ONLY minerva.mail_message_recipients
    ADD CONSTRAINT mail_message_recipients_pkey PRIMARY KEY (message_id, kind, position);
ALTER TABLE ONLY minerva.mail_message_recipients
    ADD CONSTRAINT mail_message_recipients_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_message_recipients_address_idx ON minerva.mail_message_recipients USING btree (address);

CREATE TRIGGER set_minerva_mail_message_recipients_updated_at BEFORE UPDATE ON minerva.mail_message_recipients
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Attachment types and sizes; the attachments themselves are never kept.
CREATE TABLE minerva.mail_message_attachments (
    message_id uuid NOT NULL,
    position smallint NOT NULL,
    mime_type text NOT NULL,
    extension text,
    size_bytes integer NOT NULL,
    inline boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_message_attachments_position_check CHECK (position >= 0),
    CONSTRAINT mail_message_attachments_mime_type_check CHECK (length(mime_type) BETWEEN 1 AND 255),
    CONSTRAINT mail_message_attachments_extension_check CHECK (extension IS NULL OR extension ~ '^[a-z0-9]{1,10}$'),
    CONSTRAINT mail_message_attachments_size_bytes_check CHECK (size_bytes >= 0)
);

ALTER TABLE ONLY minerva.mail_message_attachments
    ADD CONSTRAINT mail_message_attachments_pkey PRIMARY KEY (message_id, position);
ALTER TABLE ONLY minerva.mail_message_attachments
    ADD CONSTRAINT mail_message_attachments_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TRIGGER set_minerva_mail_message_attachments_updated_at BEFORE UPDATE ON minerva.mail_message_attachments
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A message's labels as Gmail has them now.
CREATE TABLE minerva.mail_message_labels (
    message_id uuid NOT NULL,
    label_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY minerva.mail_message_labels
    ADD CONSTRAINT mail_message_labels_pkey PRIMARY KEY (message_id, label_id);
ALTER TABLE ONLY minerva.mail_message_labels
    ADD CONSTRAINT mail_message_labels_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_message_labels
    ADD CONSTRAINT mail_message_labels_label_id_fkey FOREIGN KEY (label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_message_labels_label_id_idx ON minerva.mail_message_labels USING btree (label_id);

CREATE TRIGGER set_minerva_mail_message_labels_updated_at BEFORE UPDATE ON minerva.mail_message_labels
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
