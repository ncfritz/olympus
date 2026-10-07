-- Stars as states (ADR 0030; docs/plans/email-management phase 7 step 1).
-- Each account names its attention star (an open state: the message wants
-- doing) and its done star (a closed state: done): the red bang and the
-- green check (Neil, 2026-10-07).
ALTER TABLE minerva.mail_accounts
    ADD COLUMN attention_star text DEFAULT 'red-bang' NOT NULL,
    ADD COLUMN done_star text DEFAULT 'green-check' NOT NULL,
    ADD CONSTRAINT mail_accounts_stars_check CHECK (
        attention_star <> done_star AND
        attention_star IN (
            'yellow-star', 'orange-star', 'red-star', 'purple-star',
            'blue-star', 'green-star', 'red-bang', 'orange-guillemet',
            'yellow-bang', 'green-check', 'blue-info', 'purple-question'
        ) AND
        done_star IN (
            'yellow-star', 'orange-star', 'red-star', 'purple-star',
            'blue-star', 'green-star', 'red-bang', 'orange-guillemet',
            'yellow-bang', 'green-check', 'blue-info', 'purple-question'
        )
    );

-- Where a message's state and its star disagree, and the fix:
--   star            an open state, not starred: star it (Gmail's API sets
--                   STARRED; the icon is the first in Gmail's settings);
--   attention-icon  an open state, starred with another icon: set the
--                   attention icon in Gmail;
--   done-icon       a closed state still carrying the attention icon: set
--                   the done icon in Gmail.
-- A starred message whose icon sync has not found is left alone.
CREATE VIEW minerva.mail_star_mismatches AS
    SELECT m.id AS message_id, m.account_id, m.gmail_id, m.received_at,
           l.id AS label_id, l.name AS label, l.state_open,
           m.starred, m.star_icon,
           CASE
               WHEN l.state_open AND NOT m.starred THEN 'star'
               WHEN l.state_open AND m.star_icon <> a.attention_star THEN 'attention-icon'
               ELSE 'done-icon'
           END AS fix
    FROM minerva.mail_messages m
    JOIN minerva.mail_accounts a ON a.id = m.account_id
    JOIN minerva.mail_message_labels ml ON ml.message_id = m.id
    JOIN minerva.mail_labels l ON l.id = ml.label_id AND l.kind = 'state'
    WHERE (l.state_open AND NOT m.starred)
       OR (l.state_open AND m.star_icon IS NOT NULL AND m.star_icon <> a.attention_star)
       OR (NOT l.state_open AND m.starred AND m.star_icon = a.attention_star);
