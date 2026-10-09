-- Checks for migration 1790940000000_minerva_goal_category_icons: the
-- newer icons are taken, and an unknown one is still refused. Runs in a
-- transaction that is rolled back:
--
--   psql -v ON_ERROR_STOP=1 -f infra/hasura/tests/minerva_goal_category_icons.sql <database>

\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO olympus.users (id, display_name, email) VALUES
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Icons Check', 'icons-check@example.test');
INSERT INTO minerva.goal_categories (user_id, name, color, icon, position) VALUES
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Craft', '#52c41a', 'rocket', 0),
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Health', '#52c41a', 'medicine-box', 1),
    ('5f1a0c6e-0000-4000-8000-000000000001', 'Media', '#52c41a', 'video-camera', 2);

DO $$
BEGIN
    INSERT INTO minerva.goal_categories (user_id, name, color, icon, position)
        VALUES ('5f1a0c6e-0000-4000-8000-000000000001', 'Magic', '#52c41a', 'unicorn', 3);
    RAISE EXCEPTION 'an unknown icon was taken';
EXCEPTION
    WHEN check_violation THEN NULL;
END;
$$;

ROLLBACK;
