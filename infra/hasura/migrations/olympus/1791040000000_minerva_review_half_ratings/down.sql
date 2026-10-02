-- Back to whole ratings, 1 to 5. Lossy: a half rounds up, and 0.5 becomes 1;
-- unrated stays unrated (greatest() alone would turn NULL into 1).
ALTER TABLE minerva.reviews
    DROP CONSTRAINT reviews_ratings_range_check;

ALTER TABLE minerva.reviews
    ALTER COLUMN overall TYPE smallint USING CASE WHEN overall IS NULL THEN NULL ELSE greatest(1, ceil(overall)) END,
    ALTER COLUMN mood TYPE smallint USING CASE WHEN mood IS NULL THEN NULL ELSE greatest(1, ceil(mood)) END,
    ALTER COLUMN energy TYPE smallint USING CASE WHEN energy IS NULL THEN NULL ELSE greatest(1, ceil(energy)) END,
    ALTER COLUMN focus TYPE smallint USING CASE WHEN focus IS NULL THEN NULL ELSE greatest(1, ceil(focus)) END,
    ALTER COLUMN progress TYPE smallint USING CASE WHEN progress IS NULL THEN NULL ELSE greatest(1, ceil(progress)) END,
    ALTER COLUMN balance TYPE smallint USING CASE WHEN balance IS NULL THEN NULL ELSE greatest(1, ceil(balance)) END;

ALTER TABLE minerva.reviews
    ADD CONSTRAINT reviews_ratings_range_check CHECK (
        overall BETWEEN 1 AND 5 AND mood BETWEEN 1 AND 5
        AND energy BETWEEN 1 AND 5 AND focus BETWEEN 1 AND 5
        AND progress BETWEEN 1 AND 5 AND balance BETWEEN 1 AND 5);
