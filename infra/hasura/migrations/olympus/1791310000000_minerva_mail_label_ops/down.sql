DROP TABLE minerva.mail_change_label_ops;
DELETE FROM minerva.mail_change_batches WHERE kind = 'merge';
ALTER TABLE minerva.mail_change_batches
    DROP CONSTRAINT mail_change_batches_kind_check,
    ADD CONSTRAINT mail_change_batches_kind_check CHECK (kind IN ('apply', 'undo'));
