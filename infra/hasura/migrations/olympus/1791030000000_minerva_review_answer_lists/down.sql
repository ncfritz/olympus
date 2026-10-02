-- Back to one answer per prompt and review. Lossy: a list keeps only its
-- first item, and the links to the to-dos items became go (the to-dos stay).
DROP INDEX IF EXISTS minerva.review_answers_review_item_id_key;

ALTER TABLE minerva.review_answers
    DROP CONSTRAINT IF EXISTS review_answers_review_item_fkey;

ALTER TABLE minerva.review_items
    DROP CONSTRAINT IF EXISTS review_items_id_user_id_key;

ALTER TABLE minerva.review_answers
    DROP COLUMN IF EXISTS review_item_id;

DELETE FROM minerva.review_answers a
USING minerva.review_answers first
WHERE first.review_id = a.review_id
  AND first.prompt_id = a.prompt_id
  AND first.position < a.position;

ALTER TABLE minerva.review_answers
    DROP CONSTRAINT IF EXISTS review_answers_review_id_prompt_id_position_key;

ALTER TABLE minerva.review_answers
    ADD CONSTRAINT review_answers_review_id_prompt_id_key UNIQUE (review_id, prompt_id);

ALTER TABLE minerva.review_answers
    DROP COLUMN IF EXISTS position;

ALTER TABLE minerva.review_prompts
    DROP COLUMN IF EXISTS style;
