-- Gmail's star icons (docs/plans/email-management phase 1b step 4). The
-- API names only STARRED; which of the icons Gmail's settings offer a
-- starred message has is found by searching (has:yellow-star, ...). The
-- icon of a starred message, when one is found; none on an unstarred one.

ALTER TABLE minerva.mail_messages
    ADD COLUMN star_icon text,
    ADD CONSTRAINT mail_messages_star_icon_check CHECK (
        star_icon IS NULL OR (starred AND star_icon IN (
            'yellow-star', 'orange-star', 'red-star', 'purple-star',
            'blue-star', 'green-star', 'red-bang', 'orange-guillemet',
            'yellow-bang', 'green-check', 'blue-info', 'purple-question'
        ))
    );
