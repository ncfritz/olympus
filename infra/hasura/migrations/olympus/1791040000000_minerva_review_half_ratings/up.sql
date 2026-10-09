-- Half ratings (activity review plan, 2026-10-02): a rating is 0.5 to 5 in
-- steps of a half, as the site's star control gives them, so the ratings
-- become numeric(2,1). Whole ratings already given keep their values.
ALTER TABLE minerva.reviews
    DROP CONSTRAINT reviews_ratings_range_check;

ALTER TABLE minerva.reviews
    ALTER COLUMN overall TYPE numeric(2,1),
    ALTER COLUMN mood TYPE numeric(2,1),
    ALTER COLUMN energy TYPE numeric(2,1),
    ALTER COLUMN focus TYPE numeric(2,1),
    ALTER COLUMN progress TYPE numeric(2,1),
    ALTER COLUMN balance TYPE numeric(2,1);

-- Each 0.5 to 5, a whole or a half; NULL is unrated.
ALTER TABLE minerva.reviews
    ADD CONSTRAINT reviews_ratings_range_check CHECK (
        (overall BETWEEN 0.5 AND 5 AND overall * 2 = trunc(overall * 2))
        AND (mood BETWEEN 0.5 AND 5 AND mood * 2 = trunc(mood * 2))
        AND (energy BETWEEN 0.5 AND 5 AND energy * 2 = trunc(energy * 2))
        AND (focus BETWEEN 0.5 AND 5 AND focus * 2 = trunc(focus * 2))
        AND (progress BETWEEN 0.5 AND 5 AND progress * 2 = trunc(progress * 2))
        AND (balance BETWEEN 0.5 AND 5 AND balance * 2 = trunc(balance * 2)));
