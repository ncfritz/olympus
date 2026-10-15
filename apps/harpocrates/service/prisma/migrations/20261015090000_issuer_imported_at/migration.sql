-- When a CA was imported from another CA product (XCA; ADR 0037), so its
-- page offers what an imported CA may still be given: its CSR, its list.

-- AlterTable
ALTER TABLE "issuers" ADD COLUMN "imported_at" TIMESTAMP(3);

-- Those imported before, from the audit log.
UPDATE "issuers" SET "imported_at" = (
  SELECT MIN("occurred_at") FROM "audit_events"
  WHERE "kind" = 'issuer.imported'
    AND "subject_type" = 'issuer'
    AND "subject_id" = "issuers"."id"
);
