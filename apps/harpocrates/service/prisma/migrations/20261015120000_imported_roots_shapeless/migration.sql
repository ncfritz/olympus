-- An imported root has no shape (ADR 0040): Harpocrates did not choose its
-- hierarchy, so it does not hold what is beneath it to one. Roots imported
-- before were given the shape their path length suggested.
UPDATE "issuers" SET "shape" = NULL WHERE "tier" = 'root' AND "imported_at" IS NOT NULL;
