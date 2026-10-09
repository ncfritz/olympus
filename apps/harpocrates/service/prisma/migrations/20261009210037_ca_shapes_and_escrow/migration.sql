-- CreateEnum
CREATE TYPE "IssuerShape" AS ENUM ('three_tier', 'two_tier', 'direct');

-- CreateEnum
CREATE TYPE "ExtensionSet" AS ENUM ('standard', 'minimal');

-- AlterTable
ALTER TABLE "issuers" ADD COLUMN     "discarded_at" TIMESTAMP(3),
ADD COLUMN     "organization" TEXT,
ADD COLUMN     "proved_at" TIMESTAMP(3),
ADD COLUMN     "shape" "IssuerShape";

-- AlterTable
ALTER TABLE "keys" ADD COLUMN     "export_once" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "direct_only" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "escrow" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "escrow_overridable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "extensions" "ExtensionSet" NOT NULL DEFAULT 'standard';

-- Roots made before shapes (the dev CA's, imported) take theirs from their
-- path length.
UPDATE "issuers" SET "shape" = CASE "path_length"
    WHEN 2 THEN 'three_tier'::"IssuerShape"
    WHEN 1 THEN 'two_tier'::"IssuerShape"
    WHEN 0 THEN 'direct'::"IssuerShape"
  END
  WHERE "tier" = 'root';

-- Leaves a root signs directly, in its ceremonies (ADR 0032): the key
-- identifiers only, a generated P-256 key, escrowed. Its validity is the
-- default a ceremony offers; the operator may shorten it.
INSERT INTO "profiles" ("id", "description", "issuer_purpose", "key_algorithm", "validity_days", "renew_at_days", "max_key_age_days", "allow_csr", "allow_generated", "legacy_export", "require_san", "escrow", "escrow_overridable", "extensions", "direct_only") VALUES
  ('direct-minimal', 'Signed directly by a root in its ceremony: the key identifiers and nothing else', 'Direct', 'P-256', 365, 243, 730, false, true, false, false, true, true, 'minimal', true);
