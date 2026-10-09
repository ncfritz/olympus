-- Start and Stop as lists (activity review plan, 2026-10-02): next week's
-- Start and Stop are each several short items, as the priorities and to-dos
-- are, so they are asked as lists. A text answer already given is one row
-- at position 0, which is a list of one item; nothing else changes.
UPDATE minerva.review_prompts SET style = 'list'
WHERE kind = 'weekly'
  AND section = 'plan'
  AND label IN ('Start', 'Stop');
