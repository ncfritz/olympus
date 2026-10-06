-- Label kinds (ADR 0030, docs/plans/email-management phase 3). Every
-- label has a kind:
--   topical  predicted by the classifier (most labels);
--   state    one of a family's states (`Bills/*Payable`, `Bills/*Paid`):
--            the classifier predicts the family, the initial state is
--            applied, and a state counts as its family in training;
--   system   Gmail's (categories), read and written as flags, never
--            trained on;
--   retired  being merged into `merge_target_id`; picking it applies the
--            target.
-- A state is open (the message wants attention, the attention star) or
-- closed (its action is done, the done star).

CREATE TABLE minerva.mail_label_families (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    name text NOT NULL,
    -- The state a message enters the family in. Set once its labels are.
    initial_label_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_label_families_name_check CHECK (length(name) BETWEEN 1 AND 100 AND name = btrim(name))
);
ALTER TABLE ONLY minerva.mail_label_families ADD CONSTRAINT mail_label_families_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_label_families
    ADD CONSTRAINT mail_label_families_account_id_name_key UNIQUE (account_id, name);
ALTER TABLE ONLY minerva.mail_label_families
    ADD CONSTRAINT mail_label_families_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_label_families_updated_at BEFORE UPDATE ON minerva.mail_label_families
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

ALTER TABLE minerva.mail_labels
    ADD COLUMN kind text DEFAULT 'topical' NOT NULL,
    ADD COLUMN family_id uuid,
    ADD COLUMN state_open boolean,
    ADD COLUMN merge_target_id uuid;
UPDATE minerva.mail_labels SET kind = 'system' WHERE type = 'system';
ALTER TABLE minerva.mail_labels
    ADD CONSTRAINT mail_labels_kind_check CHECK (kind IN ('topical', 'state', 'system', 'retired')),
    ADD CONSTRAINT mail_labels_kind_type_check CHECK ((kind = 'system') = (type = 'system')),
    ADD CONSTRAINT mail_labels_state_check CHECK (
        (kind = 'state') = (family_id IS NOT NULL) AND (kind = 'state') = (state_open IS NOT NULL)
    ),
    ADD CONSTRAINT mail_labels_retired_check CHECK (
        (kind = 'retired') = (merge_target_id IS NOT NULL) AND merge_target_id IS DISTINCT FROM id
    ),
    ADD CONSTRAINT mail_labels_family_id_fkey FOREIGN KEY (family_id)
        REFERENCES minerva.mail_label_families(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT mail_labels_merge_target_id_fkey FOREIGN KEY (merge_target_id)
        REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE RESTRICT;
CREATE INDEX mail_labels_family_id_idx ON minerva.mail_labels USING btree (family_id) WHERE family_id IS NOT NULL;

ALTER TABLE ONLY minerva.mail_label_families
    ADD CONSTRAINT mail_label_families_initial_label_id_fkey FOREIGN KEY (initial_label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- A system label is created by the import as `type = 'system'`; its kind
-- follows, so the consumer need not know about kinds.
CREATE FUNCTION minerva.set_mail_label_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.type = 'system' THEN NEW.kind := 'system'; END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER set_minerva_mail_labels_kind BEFORE INSERT ON minerva.mail_labels
    FOR EACH ROW EXECUTE FUNCTION minerva.set_mail_label_kind();

-- The moves a family allows, from one of its states to another.
CREATE TABLE minerva.mail_label_transitions (
    family_id uuid NOT NULL,
    from_label_id uuid NOT NULL,
    to_label_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_label_transitions_distinct_check CHECK (from_label_id <> to_label_id)
);
ALTER TABLE ONLY minerva.mail_label_transitions
    ADD CONSTRAINT mail_label_transitions_pkey PRIMARY KEY (family_id, from_label_id, to_label_id);
ALTER TABLE ONLY minerva.mail_label_transitions
    ADD CONSTRAINT mail_label_transitions_family_id_fkey FOREIGN KEY (family_id)
    REFERENCES minerva.mail_label_families(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_label_transitions
    ADD CONSTRAINT mail_label_transitions_from_label_id_fkey FOREIGN KEY (from_label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_label_transitions
    ADD CONSTRAINT mail_label_transitions_to_label_id_fkey FOREIGN KEY (to_label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_label_transitions_updated_at BEFORE UPDATE ON minerva.mail_label_transitions
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
