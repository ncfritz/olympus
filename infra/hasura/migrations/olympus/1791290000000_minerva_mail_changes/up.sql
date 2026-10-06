-- Writes to Gmail (docs/plans/email-management phase 4 step 2; ADR 0030,
-- "Changes are reviewed, logged and undoable").
--
-- A batch is one decision in the site to change labels in Gmail: an apply,
-- or the undo of one. Each message in it is a change: its user labels as
-- they were when the batch was asked for ('had'), and what the batch adds
-- and removes. Labels are kept by name, so the log outlives a label merged
-- away. The agent writes the batch and reports each change's outcome:
-- written; unchanged (already as wanted); changed (edited in Gmail since,
-- so synced again instead of written); gone (no longer in Gmail, or in
-- Spam or Trash); or failed.
--
-- A decision is what was done with one proposal (a label to add to or
-- remove from a message): applied by a batch, or dismissed (processed
-- without change). Proposals show it, and a later audit or classifier run
-- proposing the same change shows it as processed rather than new.

CREATE TABLE minerva.mail_change_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    -- Who asked for it.
    user_id uuid NOT NULL,
    kind text NOT NULL,
    -- The batch an undo reverses.
    undoes_batch_id uuid,
    status text DEFAULT 'pending' NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    -- Why a batch failed as a whole (never a message's content).
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_change_batches_kind_check CHECK (kind IN ('apply', 'undo')),
    CONSTRAINT mail_change_batches_undo_check CHECK ((kind = 'undo') = (undoes_batch_id IS NOT NULL)),
    CONSTRAINT mail_change_batches_status_check CHECK (status IN ('pending', 'running', 'done', 'failed')),
    CONSTRAINT mail_change_batches_finished_check CHECK ((status IN ('done', 'failed')) = (finished_at IS NOT NULL)),
    CONSTRAINT mail_change_batches_error_check CHECK (
        (error IS NOT NULL) = (status = 'failed') AND char_length(error) <= 500
    )
);
ALTER TABLE ONLY minerva.mail_change_batches
    ADD CONSTRAINT mail_change_batches_pkey PRIMARY KEY (id);
-- A batch is undone once.
ALTER TABLE ONLY minerva.mail_change_batches
    ADD CONSTRAINT mail_change_batches_undoes_batch_id_key UNIQUE (undoes_batch_id);
ALTER TABLE ONLY minerva.mail_change_batches
    ADD CONSTRAINT mail_change_batches_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_change_batches
    ADD CONSTRAINT mail_change_batches_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_change_batches
    ADD CONSTRAINT mail_change_batches_undoes_batch_id_fkey FOREIGN KEY (undoes_batch_id)
    REFERENCES minerva.mail_change_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_change_batches_account_id_idx
    ON minerva.mail_change_batches USING btree (account_id, requested_at DESC);
CREATE TRIGGER set_minerva_mail_change_batches_updated_at BEFORE UPDATE ON minerva.mail_change_batches
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

CREATE TABLE minerva.mail_changes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    gmail_id text NOT NULL,
    -- The message while Minerva has it.
    message_id uuid,
    status text DEFAULT 'pending' NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_changes_gmail_id_check CHECK (gmail_id ~ '^[0-9a-f]{1,16}$'),
    CONSTRAINT mail_changes_status_check CHECK (
        status IN ('pending', 'written', 'unchanged', 'changed', 'gone', 'failed')
    )
);
ALTER TABLE ONLY minerva.mail_changes
    ADD CONSTRAINT mail_changes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_changes
    ADD CONSTRAINT mail_changes_batch_id_gmail_id_key UNIQUE (batch_id, gmail_id);
ALTER TABLE ONLY minerva.mail_changes
    ADD CONSTRAINT mail_changes_batch_id_fkey FOREIGN KEY (batch_id)
    REFERENCES minerva.mail_change_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_changes
    ADD CONSTRAINT mail_changes_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX mail_changes_message_id_idx ON minerva.mail_changes USING btree (message_id);
CREATE TRIGGER set_minerva_mail_changes_updated_at BEFORE UPDATE ON minerva.mail_changes
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

CREATE TABLE minerva.mail_change_labels (
    change_id uuid NOT NULL,
    role text NOT NULL,
    name text NOT NULL,
    CONSTRAINT mail_change_labels_role_check CHECK (role IN ('had', 'add', 'remove')),
    CONSTRAINT mail_change_labels_name_check CHECK (char_length(name) BETWEEN 1 AND 225)
);
ALTER TABLE ONLY minerva.mail_change_labels
    ADD CONSTRAINT mail_change_labels_pkey PRIMARY KEY (change_id, role, name);
ALTER TABLE ONLY minerva.mail_change_labels
    ADD CONSTRAINT mail_change_labels_change_id_fkey FOREIGN KEY (change_id)
    REFERENCES minerva.mail_changes(id) ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TABLE minerva.mail_decisions (
    account_id uuid NOT NULL,
    message_id uuid NOT NULL,
    label_id uuid NOT NULL,
    action text NOT NULL,
    decision text NOT NULL,
    -- The batch that applied it; none for a dismissal.
    batch_id uuid,
    user_id uuid NOT NULL,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_decisions_action_check CHECK (action IN ('add', 'remove')),
    CONSTRAINT mail_decisions_decision_check CHECK (decision IN ('applied', 'dismissed')),
    CONSTRAINT mail_decisions_batch_check CHECK ((decision = 'applied') = (batch_id IS NOT NULL))
);
ALTER TABLE ONLY minerva.mail_decisions
    ADD CONSTRAINT mail_decisions_pkey PRIMARY KEY (message_id, label_id, action);
ALTER TABLE ONLY minerva.mail_decisions
    ADD CONSTRAINT mail_decisions_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_decisions
    ADD CONSTRAINT mail_decisions_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_decisions
    ADD CONSTRAINT mail_decisions_label_id_fkey FOREIGN KEY (label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
-- Undoing a batch takes back what it applied.
ALTER TABLE ONLY minerva.mail_decisions
    ADD CONSTRAINT mail_decisions_batch_id_fkey FOREIGN KEY (batch_id)
    REFERENCES minerva.mail_change_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_decisions
    ADD CONSTRAINT mail_decisions_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES olympus.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_decisions_batch_id_idx ON minerva.mail_decisions USING btree (batch_id);
CREATE INDEX mail_decisions_label_id_idx ON minerva.mail_decisions USING btree (label_id);
CREATE TRIGGER set_minerva_mail_decisions_updated_at BEFORE UPDATE ON minerva.mail_decisions
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Proposals say what was decided about them.
CREATE OR REPLACE VIEW minerva.mail_proposals AS
    SELECT r.account_id, c.message_id, c.label_id, c.action, c.rule, c.confidence,
           c.sender_messages, c.sender_label_messages, NULL::boolean AS ticked,
           d.decision
    FROM minerva.mail_audit_changes c
    JOIN minerva.mail_audit_runs r ON r.id = c.run_id
    LEFT JOIN minerva.mail_decisions d
        ON d.message_id = c.message_id AND d.label_id = c.label_id AND d.action = c.action
    UNION ALL
    SELECT r.account_id, s.message_id, s.label_id, s.action, 'classifier', s.confidence,
           NULL::integer, NULL::integer, s.ticked,
           d.decision
    FROM minerva.mail_suggestions s
    JOIN minerva.mail_suggestion_runs r ON r.id = s.run_id AND r.status = 'ready'
    LEFT JOIN minerva.mail_decisions d
        ON d.message_id = s.message_id AND d.label_id = s.label_id AND d.action = s.action;
