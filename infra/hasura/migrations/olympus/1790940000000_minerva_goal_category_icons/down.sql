-- Back to the first ten icons; a category showing a newer one shows a star.

ALTER TABLE minerva.goal_categories DROP CONSTRAINT goal_categories_icon_check;

UPDATE minerva.goal_categories SET icon = 'star'
    WHERE icon NOT IN ('heart', 'laptop', 'team', 'wallet', 'book',
                       'home', 'star', 'compass', 'trophy', 'smile');

ALTER TABLE minerva.goal_categories ADD CONSTRAINT goal_categories_icon_check CHECK (icon IN (
    'heart', 'laptop', 'team', 'wallet', 'book',
    'home', 'star', 'compass', 'trophy', 'smile'));
