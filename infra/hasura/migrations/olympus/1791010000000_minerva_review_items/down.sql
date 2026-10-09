DROP TABLE IF EXISTS minerva.review_items;
ALTER TABLE minerva.reviews DROP CONSTRAINT IF EXISTS reviews_id_user_id_key;
