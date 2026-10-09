-- Mail statistics (ADR 0030, docs/plans/email-management phase 2): the
-- Statistics page's numbers, computed from the stored metadata on request.
-- Each function takes the user whose mail it reads (the API passes the
-- caller's ID; Hasura grants these to nobody but admin), the start of the
-- range (null for all time) and the scope: 'all', 'received' (not sent)
-- or 'sent'. Years are UTC.

-- Return types, tracked in Hasura as empty tables.
CREATE TABLE minerva.mail_statistics_summary_type (
    messages bigint NOT NULL,
    labels_in_use bigint NOT NULL,
    senders bigint NOT NULL,
    unlabelled bigint NOT NULL,
    first_received_at timestamp with time zone,
    last_received_at timestamp with time zone
);
CREATE TABLE minerva.mail_sender_statistics_type (
    address text NOT NULL,
    name text,
    messages bigint NOT NULL,
    last_received_at timestamp with time zone NOT NULL
);
CREATE TABLE minerva.mail_label_statistics_type (
    name text NOT NULL,
    messages bigint NOT NULL,
    senders bigint NOT NULL,
    last_received_at timestamp with time zone NOT NULL
);
CREATE TABLE minerva.mail_sender_year_statistics_type (
    address text NOT NULL,
    year integer NOT NULL,
    messages bigint NOT NULL
);
CREATE TABLE minerva.mail_label_year_statistics_type (
    name text NOT NULL,
    year integer NOT NULL,
    messages bigint NOT NULL
);

-- The messages a statistic reads: the user's, in range and scope.
CREATE FUNCTION minerva.mail_messages_in_scope(for_user uuid, since timestamptz, scope text)
    RETURNS SETOF minerva.mail_messages LANGUAGE sql STABLE AS $$
    SELECT m.*
    FROM minerva.mail_messages m
    JOIN minerva.mail_accounts a ON a.id = m.account_id
    WHERE a.user_id = for_user
      AND (since IS NULL OR m.received_at >= since)
      AND (scope = 'all' OR (scope = 'sent') = m.sent)
$$;

CREATE FUNCTION minerva.mail_statistics_summary(for_user uuid, since timestamptz, scope text)
    RETURNS SETOF minerva.mail_statistics_summary_type LANGUAGE sql STABLE AS $$
    WITH m AS (SELECT * FROM minerva.mail_messages_in_scope(for_user, since, scope)),
    user_labels AS (
        SELECT ml.message_id, ml.label_id
        FROM minerva.mail_message_labels ml
        JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.type = 'user'
        WHERE ml.message_id IN (SELECT id FROM m)
    )
    SELECT
        (SELECT count(*) FROM m),
        (SELECT count(DISTINCT label_id) FROM user_labels),
        (SELECT count(DISTINCT from_address) FROM m),
        (SELECT count(*) FROM m WHERE NOT EXISTS (SELECT 1 FROM user_labels u WHERE u.message_id = m.id)),
        (SELECT min(received_at) FROM m),
        (SELECT max(received_at) FROM m)
$$;

-- The busiest senders, by message count; ties by address.
CREATE FUNCTION minerva.mail_top_senders(for_user uuid, since timestamptz, scope text, top integer)
    RETURNS SETOF minerva.mail_sender_statistics_type LANGUAGE sql STABLE AS $$
    SELECT from_address, max(from_name), count(*), max(received_at)
    FROM minerva.mail_messages_in_scope(for_user, since, scope)
    WHERE from_address IS NOT NULL
    GROUP BY from_address
    ORDER BY count(*) DESC, from_address
    LIMIT top
$$;

-- The busiest user labels, by message count; ties by name.
CREATE FUNCTION minerva.mail_top_labels(for_user uuid, since timestamptz, scope text, top integer)
    RETURNS SETOF minerva.mail_label_statistics_type LANGUAGE sql STABLE AS $$
    SELECT l.name, count(*), count(DISTINCT m.from_address), max(m.received_at)
    FROM minerva.mail_messages_in_scope(for_user, since, scope) m
    JOIN minerva.mail_message_labels ml ON ml.message_id = m.id
    JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.type = 'user'
    GROUP BY l.name
    ORDER BY count(*) DESC, l.name
    LIMIT top
$$;

-- Messages per year from the top senders.
CREATE FUNCTION minerva.mail_sender_years(for_user uuid, since timestamptz, scope text, top integer)
    RETURNS SETOF minerva.mail_sender_year_statistics_type LANGUAGE sql STABLE AS $$
    WITH m AS (SELECT * FROM minerva.mail_messages_in_scope(for_user, since, scope)),
    top_senders AS (
        SELECT from_address FROM m WHERE from_address IS NOT NULL
        GROUP BY from_address ORDER BY count(*) DESC, from_address LIMIT top
    )
    SELECT m.from_address, extract(year FROM m.received_at AT TIME ZONE 'UTC')::integer, count(*)
    FROM m JOIN top_senders t ON t.from_address = m.from_address
    GROUP BY 1, 2
    ORDER BY 1, 2
$$;

-- Messages per year under the top user labels.
CREATE FUNCTION minerva.mail_label_years(for_user uuid, since timestamptz, scope text, top integer)
    RETURNS SETOF minerva.mail_label_year_statistics_type LANGUAGE sql STABLE AS $$
    WITH labelled AS (
        SELECT l.name, m.received_at
        FROM minerva.mail_messages_in_scope(for_user, since, scope) m
        JOIN minerva.mail_message_labels ml ON ml.message_id = m.id
        JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.type = 'user'
    ),
    top_labels AS (
        SELECT name FROM labelled GROUP BY name ORDER BY count(*) DESC, name LIMIT top
    )
    SELECT labelled.name, extract(year FROM received_at AT TIME ZONE 'UTC')::integer, count(*)
    FROM labelled JOIN top_labels t ON t.name = labelled.name
    GROUP BY 1, 2
    ORDER BY 1, 2
$$;
