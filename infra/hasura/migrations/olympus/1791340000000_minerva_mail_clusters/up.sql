-- Clusters of mail (docs/plans/email-management phase 6): the classifier's
-- groups of messages near one another by embedding, the map it draws them
-- on, and what they suggest: a new label for a group of unlabelled mail
-- from a tight set of senders, or splitting a label whose mail falls into
-- groups. Like the suggestion runs, a kept run per account: `building`
-- while the classifier posts to it, and publishing it drops the runs
-- before it.

CREATE TABLE minerva.mail_cluster_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    embedding_version text NOT NULL,
    status text DEFAULT 'building' NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    -- Messages with a vector, that the run clustered.
    messages integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_cluster_runs_status_check CHECK (status IN ('building', 'ready')),
    CONSTRAINT mail_cluster_runs_finished_check CHECK (
        (status = 'ready') = (finished_at IS NOT NULL)
        AND (status = 'ready') = (messages IS NOT NULL)
    ),
    CONSTRAINT mail_cluster_runs_embedding_version_check CHECK (length(embedding_version) BETWEEN 1 AND 100),
    CONSTRAINT mail_cluster_runs_messages_check CHECK (messages >= 0)
);
ALTER TABLE ONLY minerva.mail_cluster_runs ADD CONSTRAINT mail_cluster_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_cluster_runs
    ADD CONSTRAINT mail_cluster_runs_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_cluster_runs_account_id_idx ON minerva.mail_cluster_runs USING btree (account_id, status);
CREATE TRIGGER set_minerva_mail_cluster_runs_updated_at BEFORE UPDATE ON minerva.mail_cluster_runs
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A cluster: of unlabelled mail, or within one label; where it sits on the
-- map; and the label it suggests, if any.
CREATE TABLE minerva.mail_clusters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    number integer NOT NULL,
    scope text NOT NULL,
    -- For a cluster within a label, that label.
    scope_label_id uuid,
    name text NOT NULL,
    size integer NOT NULL,
    -- The share of its messages with its most common label.
    purity numeric(4, 3) NOT NULL,
    x real NOT NULL,
    y real NOT NULL,
    suggestion text,
    -- The label it proposes, by full name: new, or a sub-label of its scope.
    proposed_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_clusters_scope_check CHECK (scope IN ('unlabelled', 'label')),
    -- Unlabelled mail has no label; a label's own cluster names it, unless
    -- the label has gone since (its clusters go with it).
    CONSTRAINT mail_clusters_scope_label_check CHECK (scope = 'label' OR scope_label_id IS NULL),
    CONSTRAINT mail_clusters_suggestion_check CHECK (
        (suggestion IS NULL AND proposed_name IS NULL)
        OR (suggestion = 'new-label' AND scope = 'unlabelled' AND proposed_name IS NOT NULL)
        OR (suggestion = 'split' AND scope = 'label' AND proposed_name IS NOT NULL)
    ),
    CONSTRAINT mail_clusters_name_check CHECK (length(name) BETWEEN 1 AND 300),
    CONSTRAINT mail_clusters_proposed_name_check CHECK (proposed_name IS NULL OR length(proposed_name) BETWEEN 1 AND 225),
    CONSTRAINT mail_clusters_size_check CHECK (size >= 0),
    CONSTRAINT mail_clusters_purity_check CHECK (purity BETWEEN 0 AND 1),
    CONSTRAINT mail_clusters_xy_check CHECK (x BETWEEN 0 AND 1 AND y BETWEEN 0 AND 1)
);
ALTER TABLE ONLY minerva.mail_clusters ADD CONSTRAINT mail_clusters_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_clusters
    ADD CONSTRAINT mail_clusters_run_id_number_key UNIQUE (run_id, number);
ALTER TABLE ONLY minerva.mail_clusters
    ADD CONSTRAINT mail_clusters_run_id_fkey FOREIGN KEY (run_id)
    REFERENCES minerva.mail_cluster_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_clusters
    ADD CONSTRAINT mail_clusters_scope_label_id_fkey FOREIGN KEY (scope_label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_clusters_scope_label_id_idx ON minerva.mail_clusters USING btree (scope_label_id);
CREATE TRIGGER set_minerva_mail_clusters_updated_at BEFORE UPDATE ON minerva.mail_clusters
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Its label mix: its most common labels and how many of its messages each.
CREATE TABLE minerva.mail_cluster_labels (
    cluster_id uuid NOT NULL,
    label_id uuid NOT NULL,
    messages integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_cluster_labels_messages_check CHECK (messages >= 0)
);
ALTER TABLE ONLY minerva.mail_cluster_labels
    ADD CONSTRAINT mail_cluster_labels_pkey PRIMARY KEY (cluster_id, label_id);
ALTER TABLE ONLY minerva.mail_cluster_labels
    ADD CONSTRAINT mail_cluster_labels_cluster_id_fkey FOREIGN KEY (cluster_id)
    REFERENCES minerva.mail_clusters(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_cluster_labels
    ADD CONSTRAINT mail_cluster_labels_label_id_fkey FOREIGN KEY (label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_cluster_labels_updated_at BEFORE UPDATE ON minerva.mail_cluster_labels
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Its top senders, by address.
CREATE TABLE minerva.mail_cluster_senders (
    cluster_id uuid NOT NULL,
    sender text NOT NULL,
    messages integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_cluster_senders_sender_check CHECK (length(sender) BETWEEN 1 AND 1024),
    CONSTRAINT mail_cluster_senders_messages_check CHECK (messages >= 0)
);
ALTER TABLE ONLY minerva.mail_cluster_senders
    ADD CONSTRAINT mail_cluster_senders_pkey PRIMARY KEY (cluster_id, sender);
ALTER TABLE ONLY minerva.mail_cluster_senders
    ADD CONSTRAINT mail_cluster_senders_cluster_id_fkey FOREIGN KEY (cluster_id)
    REFERENCES minerva.mail_clusters(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_cluster_senders_updated_at BEFORE UPDATE ON minerva.mail_cluster_senders
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Its messages: what applying its suggestion changes.
CREATE TABLE minerva.mail_cluster_members (
    cluster_id uuid NOT NULL,
    message_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY minerva.mail_cluster_members
    ADD CONSTRAINT mail_cluster_members_pkey PRIMARY KEY (cluster_id, message_id);
ALTER TABLE ONLY minerva.mail_cluster_members
    ADD CONSTRAINT mail_cluster_members_cluster_id_fkey FOREIGN KEY (cluster_id)
    REFERENCES minerva.mail_clusters(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_cluster_members
    ADD CONSTRAINT mail_cluster_members_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_cluster_members_message_id_idx ON minerva.mail_cluster_members USING btree (message_id);
CREATE TRIGGER set_minerva_mail_cluster_members_updated_at BEFORE UPDATE ON minerva.mail_cluster_members
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- The map: a sample of the run's messages placed by similarity, with the
-- cluster each is in, if any.
CREATE TABLE minerva.mail_cluster_points (
    run_id uuid NOT NULL,
    message_id uuid NOT NULL,
    x real NOT NULL,
    y real NOT NULL,
    cluster_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_cluster_points_xy_check CHECK (x BETWEEN 0 AND 1 AND y BETWEEN 0 AND 1)
);
ALTER TABLE ONLY minerva.mail_cluster_points
    ADD CONSTRAINT mail_cluster_points_pkey PRIMARY KEY (run_id, message_id);
ALTER TABLE ONLY minerva.mail_cluster_points
    ADD CONSTRAINT mail_cluster_points_run_id_fkey FOREIGN KEY (run_id)
    REFERENCES minerva.mail_cluster_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_cluster_points
    ADD CONSTRAINT mail_cluster_points_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_cluster_points
    ADD CONSTRAINT mail_cluster_points_cluster_id_fkey FOREIGN KEY (cluster_id)
    REFERENCES minerva.mail_clusters(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_cluster_points_updated_at BEFORE UPDATE ON minerva.mail_cluster_points
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();
