-- Brings the column back, filled with each note's owner's email: what was
-- in it before is gone.
ALTER TABLE minerva.notes ADD COLUMN author text;
UPDATE minerva.notes n SET author = u.email FROM olympus.users u WHERE u.id = n.user_id;
ALTER TABLE minerva.notes ALTER COLUMN author SET NOT NULL;
