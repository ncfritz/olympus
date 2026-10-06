-- Label operations in change batches (docs/plans/email-management phase 4
-- step 3): a batch can create, rename and delete labels in Gmail as well
-- as move messages, which is what merges, new sub-labels and labels made
-- in the picker need. The agent creates and renames first, then writes
-- the messages, then deletes, and deletes a label only once Gmail says it
-- is empty. Each operation is logged with its outcome, so a batch's undo
-- can reverse it: a create by a delete, a rename by the rename back, a
-- delete by a create.

ALTER TABLE minerva.mail_change_batches
    DROP CONSTRAINT mail_change_batches_kind_check,
    ADD CONSTRAINT mail_change_batches_kind_check CHECK (kind IN ('apply', 'undo', 'merge'));

CREATE TABLE minerva.mail_change_label_ops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    op text NOT NULL,
    -- The label by full name as it is when the operation runs.
    name text NOT NULL,
    -- A rename's new name.
    new_name text,
    -- Gmail's ID for a label the batch created.
    gmail_label_id text,
    status text DEFAULT 'pending' NOT NULL,
    -- Why it was skipped or failed.
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_change_label_ops_op_check CHECK (op IN ('create', 'rename', 'delete')),
    CONSTRAINT mail_change_label_ops_new_name_check CHECK (
        (op = 'rename') = (new_name IS NOT NULL)
        AND (new_name IS NULL OR char_length(new_name) BETWEEN 1 AND 225)
    ),
    CONSTRAINT mail_change_label_ops_name_check CHECK (char_length(name) BETWEEN 1 AND 225),
    CONSTRAINT mail_change_label_ops_status_check CHECK (status IN ('pending', 'done', 'skipped', 'failed')),
    CONSTRAINT mail_change_label_ops_detail_check CHECK (detail IS NULL OR char_length(detail) <= 500)
);
ALTER TABLE ONLY minerva.mail_change_label_ops
    ADD CONSTRAINT mail_change_label_ops_pkey PRIMARY KEY (id);
-- One operation of a kind on a label per batch.
ALTER TABLE ONLY minerva.mail_change_label_ops
    ADD CONSTRAINT mail_change_label_ops_batch_id_op_name_key UNIQUE (batch_id, op, name);
ALTER TABLE ONLY minerva.mail_change_label_ops
    ADD CONSTRAINT mail_change_label_ops_batch_id_fkey FOREIGN KEY (batch_id)
    REFERENCES minerva.mail_change_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_change_label_ops_updated_at BEFORE UPDATE ON minerva.mail_change_label_ops
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
