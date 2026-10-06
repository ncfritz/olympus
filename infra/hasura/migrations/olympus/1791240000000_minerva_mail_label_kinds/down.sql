DROP TABLE minerva.mail_label_transitions;
DROP TRIGGER set_minerva_mail_labels_kind ON minerva.mail_labels;
DROP FUNCTION minerva.set_mail_label_kind();
ALTER TABLE minerva.mail_label_families DROP CONSTRAINT mail_label_families_initial_label_id_fkey;
DROP INDEX minerva.mail_labels_family_id_idx;
ALTER TABLE minerva.mail_labels
    DROP CONSTRAINT mail_labels_merge_target_id_fkey,
    DROP CONSTRAINT mail_labels_family_id_fkey,
    DROP CONSTRAINT mail_labels_retired_check,
    DROP CONSTRAINT mail_labels_state_check,
    DROP CONSTRAINT mail_labels_kind_type_check,
    DROP CONSTRAINT mail_labels_kind_check,
    DROP COLUMN merge_target_id,
    DROP COLUMN state_open,
    DROP COLUMN family_id,
    DROP COLUMN kind;
DROP TABLE minerva.mail_label_families;
