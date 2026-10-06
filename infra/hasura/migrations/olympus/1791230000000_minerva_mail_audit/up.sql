-- The mail audit (ADR 0030, docs/plans/email-management phase 2): rules
-- over the stored metadata that propose label changes, list threads whose
-- messages disagree, and find labels that may be one. A run is computed
-- by mail_run_audit and kept, so the Re-classification page, its label
-- drill-down and the CSV export read one consistent set; phase 4 adds a
-- status to each proposal. A new run replaces the account's last.

CREATE TABLE minerva.mail_audit_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone NOT NULL,
    messages_examined integer NOT NULL,
    senders_examined integer NOT NULL,
    consistent_senders integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_audit_runs_counts_check CHECK (
        messages_examined >= 0 AND senders_examined >= 0 AND consistent_senders >= 0
    )
);
ALTER TABLE ONLY minerva.mail_audit_runs ADD CONSTRAINT mail_audit_runs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY minerva.mail_audit_runs
    ADD CONSTRAINT mail_audit_runs_account_id_fkey FOREIGN KEY (account_id)
    REFERENCES minerva.mail_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_audit_runs_account_id_idx ON minerva.mail_audit_runs USING btree (account_id, started_at);
CREATE TRIGGER set_minerva_mail_audit_runs_updated_at BEFORE UPDATE ON minerva.mail_audit_runs
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A proposed change: add or remove one label on one message, by a rule,
-- with the evidence it rests on. `sender`: the sender's own habit, its
-- messages (sender_messages) and how many carry the label
-- (sender_label_messages); confidence is that share for an add and one
-- less it for a remove.
CREATE TABLE minerva.mail_audit_changes (
    run_id uuid NOT NULL,
    message_id uuid NOT NULL,
    label_id uuid NOT NULL,
    action text NOT NULL,
    rule text NOT NULL,
    confidence numeric(4, 3) NOT NULL,
    sender_messages integer NOT NULL,
    sender_label_messages integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_audit_changes_action_check CHECK (action IN ('add', 'remove')),
    CONSTRAINT mail_audit_changes_rule_check CHECK (rule IN ('sender')),
    CONSTRAINT mail_audit_changes_confidence_check CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT mail_audit_changes_counts_check CHECK (
        sender_messages > 0 AND sender_label_messages BETWEEN 0 AND sender_messages
    )
);
ALTER TABLE ONLY minerva.mail_audit_changes
    ADD CONSTRAINT mail_audit_changes_pkey PRIMARY KEY (run_id, message_id, label_id, action);
ALTER TABLE ONLY minerva.mail_audit_changes
    ADD CONSTRAINT mail_audit_changes_run_id_fkey FOREIGN KEY (run_id)
    REFERENCES minerva.mail_audit_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_audit_changes
    ADD CONSTRAINT mail_audit_changes_message_id_fkey FOREIGN KEY (message_id)
    REFERENCES minerva.mail_messages(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_audit_changes
    ADD CONSTRAINT mail_audit_changes_label_id_fkey FOREIGN KEY (label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE INDEX mail_audit_changes_run_id_label_id_idx ON minerva.mail_audit_changes USING btree (run_id, label_id);
CREATE INDEX mail_audit_changes_message_id_idx ON minerva.mail_audit_changes USING btree (message_id);
CREATE TRIGGER set_minerva_mail_audit_changes_updated_at BEFORE UPDATE ON minerva.mail_audit_changes
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Two labels that may be one, `from` the smaller into the larger: the same
-- leaf name under different parents (`same_leaf`), or most of the smaller
-- one's senders also the larger one's (`sender_overlap`, the share of the
-- smaller one's senders in common).
CREATE TABLE minerva.mail_audit_merges (
    run_id uuid NOT NULL,
    from_label_id uuid NOT NULL,
    into_label_id uuid NOT NULL,
    reason text NOT NULL,
    shared_senders integer NOT NULL,
    from_senders integer NOT NULL,
    sender_overlap numeric(4, 3) NOT NULL,
    from_messages integer NOT NULL,
    into_messages integer NOT NULL,
    from_last_received_at timestamp with time zone,
    into_last_received_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_audit_merges_reason_check CHECK (reason IN ('same_leaf', 'sender_overlap')),
    CONSTRAINT mail_audit_merges_distinct_check CHECK (from_label_id <> into_label_id),
    CONSTRAINT mail_audit_merges_overlap_check CHECK (sender_overlap BETWEEN 0 AND 1)
);
ALTER TABLE ONLY minerva.mail_audit_merges
    ADD CONSTRAINT mail_audit_merges_pkey PRIMARY KEY (run_id, from_label_id, into_label_id);
ALTER TABLE ONLY minerva.mail_audit_merges
    ADD CONSTRAINT mail_audit_merges_run_id_fkey FOREIGN KEY (run_id)
    REFERENCES minerva.mail_audit_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_audit_merges
    ADD CONSTRAINT mail_audit_merges_from_label_id_fkey FOREIGN KEY (from_label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY minerva.mail_audit_merges
    ADD CONSTRAINT mail_audit_merges_into_label_id_fkey FOREIGN KEY (into_label_id)
    REFERENCES minerva.mail_labels(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_audit_merges_updated_at BEFORE UPDATE ON minerva.mail_audit_merges
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- A thread whose messages carry different sets of user labels.
CREATE TABLE minerva.mail_audit_threads (
    run_id uuid NOT NULL,
    thread_id text NOT NULL,
    messages integer NOT NULL,
    label_sets integer NOT NULL,
    last_received_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mail_audit_threads_counts_check CHECK (messages >= 2 AND label_sets BETWEEN 2 AND messages)
);
ALTER TABLE ONLY minerva.mail_audit_threads
    ADD CONSTRAINT mail_audit_threads_pkey PRIMARY KEY (run_id, thread_id);
ALTER TABLE ONLY minerva.mail_audit_threads
    ADD CONSTRAINT mail_audit_threads_run_id_fkey FOREIGN KEY (run_id)
    REFERENCES minerva.mail_audit_runs(id) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TRIGGER set_minerva_mail_audit_threads_updated_at BEFORE UPDATE ON minerva.mail_audit_threads
    FOR EACH ROW EXECUTE FUNCTION minerva.set_current_timestamp_updated_at();

-- Runs the audit over each of the user's accounts, replacing its last run,
-- and answers the new runs. The thresholds are the plan's starting points:
-- a sender counts as consistent with five received messages and one label
-- on four in five of them; a label it uses on fewer than one in ten is
-- proposed for removal; labels of ten messages or more whose smaller
-- one shares three senders and three in five of its senders with the
-- larger are merge candidates.
CREATE FUNCTION minerva.mail_run_audit(for_user uuid)
    RETURNS SETOF minerva.mail_audit_runs LANGUAGE plpgsql VOLATILE AS $$
DECLARE
    min_sender_messages constant integer := 5;
    min_main_share constant numeric := 0.8;
    max_stray_share constant numeric := 0.1;
    min_label_messages constant integer := 10;
    min_shared_senders constant integer := 3;
    min_overlap constant numeric := 0.6;
    acct uuid;
    this_run uuid;
    started timestamp with time zone;
BEGIN
    FOR acct IN SELECT id FROM minerva.mail_accounts WHERE user_id = for_user ORDER BY id LOOP
        started := clock_timestamp();
        DELETE FROM minerva.mail_audit_runs WHERE account_id = acct;
        INSERT INTO minerva.mail_audit_runs
            (account_id, started_at, finished_at, messages_examined, senders_examined, consistent_senders)
            VALUES (acct, started, started, 0, 0, 0)
            RETURNING id INTO this_run;

        -- Received mail with a sender, and its user labels.
        CREATE TEMP TABLE audit_received ON COMMIT DROP AS
            SELECT id AS message_id, from_address
            FROM minerva.mail_messages
            WHERE account_id = acct AND NOT sent AND from_address IS NOT NULL;
        CREATE TEMP TABLE audit_labelled ON COMMIT DROP AS
            SELECT r.message_id, r.from_address, ml.label_id
            FROM audit_received r
            JOIN minerva.mail_message_labels ml ON ml.message_id = r.message_id
            JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.type = 'user';
        CREATE TEMP TABLE audit_senders ON COMMIT DROP AS
            SELECT from_address, count(*)::integer AS messages
            FROM audit_received GROUP BY from_address;
        CREATE TEMP TABLE audit_sender_labels ON COMMIT DROP AS
            SELECT from_address, label_id, count(*)::integer AS messages
            FROM audit_labelled GROUP BY from_address, label_id;
        -- Each consistent sender's usual label.
        CREATE TEMP TABLE audit_usual ON COMMIT DROP AS
            SELECT DISTINCT ON (sl.from_address) sl.from_address, sl.label_id, sl.messages AS label_messages, s.messages
            FROM audit_sender_labels sl
            JOIN audit_senders s ON s.from_address = sl.from_address
            WHERE s.messages >= min_sender_messages
            ORDER BY sl.from_address, sl.messages DESC, sl.label_id;
        DELETE FROM audit_usual WHERE label_messages < min_main_share * messages;

        -- Add the usual label where it is missing.
        INSERT INTO minerva.mail_audit_changes
            (run_id, message_id, label_id, action, rule, confidence, sender_messages, sender_label_messages)
        SELECT this_run, r.message_id, u.label_id, 'add', 'sender',
               round(u.label_messages::numeric / u.messages, 3), u.messages, u.label_messages
        FROM audit_received r
        JOIN audit_usual u ON u.from_address = r.from_address
        WHERE NOT EXISTS (
            SELECT 1 FROM minerva.mail_message_labels ml
            WHERE ml.message_id = r.message_id AND ml.label_id = u.label_id
        );
        -- Remove a label the sender seldom gets.
        INSERT INTO minerva.mail_audit_changes
            (run_id, message_id, label_id, action, rule, confidence, sender_messages, sender_label_messages)
        SELECT this_run, a.message_id, a.label_id, 'remove', 'sender',
               round(1 - sl.messages::numeric / u.messages, 3), u.messages, sl.messages
        FROM audit_labelled a
        JOIN audit_usual u ON u.from_address = a.from_address AND u.label_id <> a.label_id
        JOIN audit_sender_labels sl ON sl.from_address = a.from_address AND sl.label_id = a.label_id
        WHERE sl.messages < max_stray_share * u.messages;

        -- Threads whose messages disagree on their user labels.
        INSERT INTO minerva.mail_audit_threads (run_id, thread_id, messages, label_sets, last_received_at)
        SELECT this_run, thread_id, count(*), count(DISTINCT labels), max(received_at)
        FROM (
            SELECT m.thread_id, m.received_at,
                   coalesce(string_agg(l.id::text, ',' ORDER BY l.id), '') AS labels
            FROM minerva.mail_messages m
            JOIN (
                SELECT thread_id FROM minerva.mail_messages
                WHERE account_id = acct GROUP BY thread_id HAVING count(*) > 1
            ) threaded ON threaded.thread_id = m.thread_id
            LEFT JOIN minerva.mail_message_labels ml ON ml.message_id = m.id
            LEFT JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.type = 'user'
            WHERE m.account_id = acct
            GROUP BY m.id, m.thread_id, m.received_at
        ) per_message
        GROUP BY thread_id
        HAVING count(DISTINCT labels) > 1;

        -- Labels' sizes and senders, over all the account's mail.
        CREATE TEMP TABLE audit_label_sizes ON COMMIT DROP AS
            SELECT l.id AS label_id, l.name, lower(regexp_replace(l.name, '^.*/', '')) AS leaf,
                   count(m.id)::integer AS messages, max(m.received_at) AS last_received_at
            FROM minerva.mail_labels l
            LEFT JOIN minerva.mail_message_labels ml ON ml.label_id = l.id
            LEFT JOIN minerva.mail_messages m ON m.id = ml.message_id
            WHERE l.account_id = acct AND l.type = 'user'
            GROUP BY l.id, l.name;
        -- A label's senders: those with two messages or more under it, so a
        -- stray message (which the sender rule deals with) does not tie two
        -- labels together.
        CREATE TEMP TABLE audit_label_senders ON COMMIT DROP AS
            SELECT ml.label_id, m.from_address
            FROM minerva.mail_message_labels ml
            JOIN audit_label_sizes ls ON ls.label_id = ml.label_id AND ls.messages >= min_label_messages
            JOIN minerva.mail_messages m ON m.id = ml.message_id AND m.from_address IS NOT NULL AND NOT m.sent
            GROUP BY ml.label_id, m.from_address
            HAVING count(*) >= 2;
        CREATE INDEX ON audit_label_senders (from_address, label_id);
        ANALYZE audit_label_senders;
        CREATE TEMP TABLE audit_label_sender_counts ON COMMIT DROP AS
            SELECT label_id, count(*)::integer AS senders FROM audit_label_senders GROUP BY label_id;
        -- Senders each pair of labels has in common.
        CREATE TEMP TABLE audit_shared ON COMMIT DROP AS
            SELECT a.label_id AS from_id, b.label_id AS into_id, count(*)::integer AS shared
            FROM audit_label_senders a
            JOIN audit_label_senders b ON b.from_address = a.from_address AND b.label_id <> a.label_id
            GROUP BY a.label_id, b.label_id;
        CREATE INDEX ON audit_shared (from_id, into_id);

        -- A duplicated root: a top-level label and another with the same leaf
        -- (`Advertisements` and `Accounts/Advertisements`), the smaller into
        -- the larger. The same leaf under two parents is often deliberate
        -- (`Amazon/Receipts`, `Apple/Receipts`); those count only by senders.
        INSERT INTO minerva.mail_audit_merges
            (run_id, from_label_id, into_label_id, reason, shared_senders, from_senders, sender_overlap,
             from_messages, into_messages, from_last_received_at, into_last_received_at)
        SELECT this_run, f.label_id, i.label_id, 'same_leaf',
               coalesce(shared.n, 0), coalesce(fc.senders, 0),
               CASE WHEN coalesce(fc.senders, 0) = 0 THEN 0
                    ELSE round(coalesce(shared.n, 0)::numeric / fc.senders, 3) END,
               f.messages, i.messages, f.last_received_at, i.last_received_at
        FROM audit_label_sizes f
        JOIN audit_label_sizes i ON i.leaf = f.leaf AND i.label_id <> f.label_id
            AND (i.messages > f.messages OR (i.messages = f.messages AND i.name < f.name))
            AND (strpos(f.name, '/') = 0 OR strpos(i.name, '/') = 0)
        LEFT JOIN audit_label_sender_counts fc ON fc.label_id = f.label_id
        LEFT JOIN (SELECT from_id, into_id, shared AS n FROM audit_shared) shared
            ON shared.from_id = f.label_id AND shared.into_id = i.label_id;

        -- Most of the smaller label's senders also the larger's.
        INSERT INTO minerva.mail_audit_merges
            (run_id, from_label_id, into_label_id, reason, shared_senders, from_senders, sender_overlap,
             from_messages, into_messages, from_last_received_at, into_last_received_at)
        SELECT this_run, pairs.from_id, pairs.into_id, 'sender_overlap', pairs.shared, fc.senders,
               round(pairs.shared::numeric / fc.senders, 3),
               f.messages, i.messages, f.last_received_at, i.last_received_at
        FROM audit_shared pairs
        JOIN audit_label_sender_counts fc ON fc.label_id = pairs.from_id
        JOIN audit_label_sender_counts ic ON ic.label_id = pairs.into_id
        JOIN audit_label_sizes f ON f.label_id = pairs.from_id
        JOIN audit_label_sizes i ON i.label_id = pairs.into_id
        WHERE pairs.shared >= min_shared_senders
          AND pairs.shared >= min_overlap * fc.senders
          AND (i.messages > f.messages OR (i.messages = f.messages AND i.name < f.name))
          -- A label and its own parent or child share senders by design.
          AND i.name NOT LIKE f.name || '/%' AND f.name NOT LIKE i.name || '/%'
          AND NOT EXISTS (
              SELECT 1 FROM minerva.mail_audit_merges x
              WHERE x.run_id = this_run
                AND x.from_label_id = pairs.from_id AND x.into_label_id = pairs.into_id
          );

        UPDATE minerva.mail_audit_runs SET
            finished_at = clock_timestamp(),
            messages_examined = (SELECT count(*) FROM audit_received),
            senders_examined = (SELECT count(*) FROM audit_senders WHERE messages >= min_sender_messages),
            consistent_senders = (SELECT count(*) FROM audit_usual)
        WHERE id = this_run;

        DROP TABLE audit_received, audit_labelled, audit_senders, audit_sender_labels, audit_usual,
            audit_label_sizes, audit_label_senders, audit_label_sender_counts, audit_shared;

        RETURN QUERY SELECT * FROM minerva.mail_audit_runs WHERE id = this_run;
    END LOOP;
END $$;

-- The latest run's totals over the user's accounts, for the
-- Re-classification page's strip. No row when the user has no run.
CREATE TABLE minerva.mail_audit_summary_type (
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone NOT NULL,
    messages_examined bigint NOT NULL,
    consistent_senders bigint NOT NULL,
    changes bigint NOT NULL,
    additions bigint NOT NULL,
    removals bigint NOT NULL,
    high_confidence bigint NOT NULL,
    messages_affected bigint NOT NULL,
    merges bigint NOT NULL,
    threads bigint NOT NULL
);
CREATE FUNCTION minerva.mail_audit_summary(for_user uuid, high numeric)
    RETURNS SETOF minerva.mail_audit_summary_type LANGUAGE sql STABLE AS $$
    WITH runs AS (
        SELECT r.* FROM minerva.mail_audit_runs r
        JOIN minerva.mail_accounts a ON a.id = r.account_id AND a.user_id = for_user
    )
    SELECT min(started_at), max(finished_at),
           sum(messages_examined), sum(consistent_senders),
           (SELECT count(*) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs)),
           (SELECT count(*) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs) AND c.action = 'add'),
           (SELECT count(*) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs) AND c.action = 'remove'),
           (SELECT count(*) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs) AND c.confidence >= high),
           (SELECT count(DISTINCT c.message_id) FROM minerva.mail_audit_changes c WHERE c.run_id IN (SELECT id FROM runs)),
           (SELECT count(*) FROM minerva.mail_audit_merges g WHERE g.run_id IN (SELECT id FROM runs)),
           (SELECT count(*) FROM minerva.mail_audit_threads t WHERE t.run_id IN (SELECT id FROM runs))
    FROM runs
    HAVING count(*) > 0
$$;

-- Every user label with its messages and the latest run's proposals into
-- and out of it, for the Re-classification page's label tree.
CREATE TABLE minerva.mail_audit_label_type (
    name text NOT NULL,
    messages bigint NOT NULL,
    last_received_at timestamp with time zone,
    proposed_in bigint NOT NULL,
    proposed_out bigint NOT NULL,
    high_confidence bigint NOT NULL,
    merge_candidate boolean NOT NULL
);
CREATE FUNCTION minerva.mail_audit_labels(for_user uuid, high numeric)
    RETURNS SETOF minerva.mail_audit_label_type LANGUAGE sql STABLE AS $$
    WITH labels AS (
        SELECT l.* FROM minerva.mail_labels l
        JOIN minerva.mail_accounts a ON a.id = l.account_id AND a.user_id = for_user
        WHERE l.type = 'user'
    ),
    runs AS (
        SELECT r.id FROM minerva.mail_audit_runs r
        JOIN minerva.mail_accounts a ON a.id = r.account_id AND a.user_id = for_user
    ),
    sizes AS (
        SELECT ml.label_id, count(*) AS messages, max(m.received_at) AS last_received_at
        FROM minerva.mail_message_labels ml
        JOIN labels ON labels.id = ml.label_id
        JOIN minerva.mail_messages m ON m.id = ml.message_id
        GROUP BY ml.label_id
    ),
    proposed AS (
        SELECT c.label_id,
               count(*) FILTER (WHERE c.action = 'add') AS proposed_in,
               count(*) FILTER (WHERE c.action = 'remove') AS proposed_out,
               count(*) FILTER (WHERE c.confidence >= high) AS high_confidence
        FROM minerva.mail_audit_changes c
        WHERE c.run_id IN (SELECT id FROM runs)
        GROUP BY c.label_id
    ),
    merging AS (
        SELECT from_label_id AS label_id FROM minerva.mail_audit_merges WHERE run_id IN (SELECT id FROM runs)
        UNION
        SELECT into_label_id FROM minerva.mail_audit_merges WHERE run_id IN (SELECT id FROM runs)
    )
    SELECT labels.name, coalesce(sizes.messages, 0), sizes.last_received_at,
           coalesce(proposed.proposed_in, 0), coalesce(proposed.proposed_out, 0),
           coalesce(proposed.high_confidence, 0),
           EXISTS (SELECT 1 FROM merging WHERE merging.label_id = labels.id)
    FROM labels
    LEFT JOIN sizes ON sizes.label_id = labels.id
    LEFT JOIN proposed ON proposed.label_id = labels.id
    ORDER BY labels.name
$$;

-- Stars (ADR 0030: a star marks a message needing attention, or its action
-- done). Live over the user's mail, like the statistics. Takeout records
-- no star icon, so these count stars of any kind until phase 1b.
CREATE TABLE minerva.mail_star_label_type (
    name text NOT NULL,
    messages bigint NOT NULL,
    starred bigint NOT NULL
);
CREATE TABLE minerva.mail_star_sender_type (
    address text NOT NULL,
    messages bigint NOT NULL,
    starred bigint NOT NULL
);
CREATE TABLE minerva.mail_star_age_type (
    age text NOT NULL,
    starred bigint NOT NULL
);
CREATE TABLE minerva.mail_star_mixed_type (
    address text NOT NULL,
    subject_pattern text NOT NULL,
    messages bigint NOT NULL,
    starred bigint NOT NULL,
    last_received_at timestamp with time zone NOT NULL
);

-- User labels with the most starred messages.
CREATE FUNCTION minerva.mail_star_labels(for_user uuid, top integer)
    RETURNS SETOF minerva.mail_star_label_type LANGUAGE sql STABLE AS $$
    SELECT l.name, count(*), count(*) FILTER (WHERE m.starred)
    FROM minerva.mail_messages m
    JOIN minerva.mail_accounts a ON a.id = m.account_id AND a.user_id = for_user
    JOIN minerva.mail_message_labels ml ON ml.message_id = m.id
    JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.type = 'user'
    GROUP BY l.name
    HAVING count(*) FILTER (WHERE m.starred) > 0
    ORDER BY count(*) FILTER (WHERE m.starred) DESC, l.name
    LIMIT top
$$;

-- Senders with the most starred messages.
CREATE FUNCTION minerva.mail_star_senders(for_user uuid, top integer)
    RETURNS SETOF minerva.mail_star_sender_type LANGUAGE sql STABLE AS $$
    SELECT m.from_address, count(*), count(*) FILTER (WHERE m.starred)
    FROM minerva.mail_messages m
    JOIN minerva.mail_accounts a ON a.id = m.account_id AND a.user_id = for_user
    WHERE m.from_address IS NOT NULL
    GROUP BY m.from_address
    HAVING count(*) FILTER (WHERE m.starred) > 0
    ORDER BY count(*) FILTER (WHERE m.starred) DESC, m.from_address
    LIMIT top
$$;

-- Starred messages by age: received in the last month, the last year, or
-- before. A star still on old mail is often an attention star never
-- cleared.
CREATE FUNCTION minerva.mail_star_ages(for_user uuid)
    RETURNS SETOF minerva.mail_star_age_type LANGUAGE sql STABLE AS $$
    SELECT age, coalesce(n, 0)
    FROM (VALUES ('month', 1), ('year', 2), ('older', 3)) AS ages(age, ord)
    LEFT JOIN (
        SELECT CASE
                 WHEN m.received_at >= now() - interval '1 month' THEN 'month'
                 WHEN m.received_at >= now() - interval '1 year' THEN 'year'
                 ELSE 'older'
               END AS bucket,
               count(*) AS n
        FROM minerva.mail_messages m
        JOIN minerva.mail_accounts a ON a.id = m.account_id AND a.user_id = for_user
        WHERE m.starred
        GROUP BY 1
    ) counts ON counts.bucket = ages.age
    ORDER BY ord
$$;

-- Near-identical mail starred and not: three or more messages from one
-- sender whose subjects match once digits are set aside (`Bill for #/#`),
-- some starred and some not.
CREATE FUNCTION minerva.mail_star_mixed(for_user uuid, top integer)
    RETURNS SETOF minerva.mail_star_mixed_type LANGUAGE sql STABLE AS $$
    SELECT from_address, pattern, count(*), count(*) FILTER (WHERE starred), max(received_at)
    FROM (
        SELECT m.from_address, m.starred, m.received_at,
               regexp_replace(regexp_replace(lower(m.subject), '[0-9]+', '#', 'g'), '\s+', ' ', 'g') AS pattern
        FROM minerva.mail_messages m
        JOIN minerva.mail_accounts a ON a.id = m.account_id AND a.user_id = for_user
        WHERE m.from_address IS NOT NULL AND m.subject IS NOT NULL
    ) subjects
    GROUP BY from_address, pattern
    HAVING count(*) >= 3
       AND count(*) FILTER (WHERE starred) > 0
       AND count(*) FILTER (WHERE starred) < count(*)
    ORDER BY count(*) DESC, from_address, pattern
    LIMIT top
$$;
