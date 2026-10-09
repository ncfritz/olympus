-- More icons for goal categories: the ten the starter set uses and thirty
-- more, as the model's GoalCategoryIcon lists them.

ALTER TABLE minerva.goal_categories DROP CONSTRAINT goal_categories_icon_check;

ALTER TABLE minerva.goal_categories ADD CONSTRAINT goal_categories_icon_check CHECK (icon IN (
    'heart', 'laptop', 'team', 'wallet', 'book',
    'home', 'star', 'compass', 'trophy', 'smile',
    'rocket', 'bulb', 'car', 'coffee', 'camera',
    'gift', 'global', 'medicine-box', 'shopping', 'tool',
    'experiment', 'fire', 'thunderbolt', 'read', 'customer-service',
    'dollar', 'bank', 'build', 'code', 'cloud',
    'crown', 'environment', 'flag', 'sun', 'moon',
    'user', 'safety', 'schedule', 'aim', 'video-camera'));
