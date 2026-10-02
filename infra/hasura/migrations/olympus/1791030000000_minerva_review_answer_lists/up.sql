-- Answers as lists (ADR 0027, activity review plan phase 5a). A prompt is
-- answered either as one block of text or as a list of short items, each
-- its own answer row in its order, so the weekly review can pin one item.
-- A list item can become a to-do of the period after its review's.

-- How a prompt is answered: one block of text, or a list of items. The API
-- keeps a text prompt to one answer per review.
ALTER TABLE minerva.review_prompts
    ADD COLUMN style text DEFAULT 'text' NOT NULL;

ALTER TABLE minerva.review_prompts
    ADD CONSTRAINT review_prompts_style_check CHECK (style IN ('text', 'list'));

-- The starter prompts asked as lists (Neil, 2026-10-02). New users get
-- them as lists from the API's starter set; this turns existing ones over.
UPDATE minerva.review_prompts SET style = 'list'
WHERE (kind, label) IN (
    ('daily', 'What went well?'),
    ('daily', 'What didn’t go well?'),
    ('daily', 'What’s on my mind?'),
    ('daily', 'Thoughts for tomorrow'),
    ('weekly', 'Biggest win'),
    ('weekly', 'What got in the way'),
    ('weekly', 'What I learned'),
    ('weekly', 'What to change next week'));

-- An answer's place among its prompt's items in its review; a text answer
-- is the only one, at 0. Deferred, as the other orders are, so a reorder can
-- pass through a moment where two items share a position.
ALTER TABLE minerva.review_answers
    ADD COLUMN position integer DEFAULT 0 NOT NULL;

ALTER TABLE minerva.review_answers
    ADD CONSTRAINT review_answers_position_check CHECK (position >= 0);

ALTER TABLE minerva.review_answers
    DROP CONSTRAINT review_answers_review_id_prompt_id_key;

ALTER TABLE minerva.review_answers
    ADD CONSTRAINT review_answers_review_id_prompt_id_position_key
    UNIQUE (review_id, prompt_id, position) DEFERRABLE INITIALLY DEFERRED;

-- The to-do a list item became, if it did. With user_id it keys the item,
-- so the to-do is the answer's user's; deleting the to-do clears the link
-- and leaves the answer.
ALTER TABLE minerva.review_answers
    ADD COLUMN review_item_id uuid;

ALTER TABLE ONLY minerva.review_items
    ADD CONSTRAINT review_items_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE ONLY minerva.review_answers
    ADD CONSTRAINT review_answers_review_item_fkey FOREIGN KEY (review_item_id, user_id)
    REFERENCES minerva.review_items(id, user_id) ON UPDATE CASCADE ON DELETE SET NULL (review_item_id);

-- An item becomes one to-do, once.
CREATE UNIQUE INDEX review_answers_review_item_id_key
    ON minerva.review_answers USING btree (review_item_id) WHERE review_item_id IS NOT NULL;
