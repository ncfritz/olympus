-- Start and Stop back to text. Lossy: a list keeps only its first item, as
-- a text prompt holds one answer per review; links from the dropped items
-- to to-dos go with them (the to-dos stay).
DELETE FROM minerva.review_answers a
USING minerva.review_prompts p, minerva.review_answers first
WHERE p.id = a.prompt_id
  AND p.kind = 'weekly'
  AND p.section = 'plan'
  AND p.label IN ('Start', 'Stop')
  AND first.review_id = a.review_id
  AND first.prompt_id = a.prompt_id
  AND first.position < a.position;

UPDATE minerva.review_prompts SET style = 'text'
WHERE kind = 'weekly'
  AND section = 'plan'
  AND label IN ('Start', 'Stop');
