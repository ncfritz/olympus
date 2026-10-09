DROP VIEW minerva.mail_star_mismatches;
ALTER TABLE minerva.mail_accounts
    DROP CONSTRAINT mail_accounts_stars_check,
    DROP COLUMN done_star,
    DROP COLUMN attention_star;
