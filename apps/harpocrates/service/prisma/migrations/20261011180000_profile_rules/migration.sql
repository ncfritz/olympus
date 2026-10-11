-- Profile rules (ADR 0034, phase 10 step 3), behaviour-preserving for
-- what exists: every usage a version lists is forced, as it always was;
-- a listed name type is allowed and require_san becomes min_names 1;
-- subjects take a common name (required) and an OU and O (optional); and
-- no version limits key types or CSR hashes.

-- CreateEnum
CREATE TYPE "UsageState" AS ENUM ('forced', 'default', 'optional');

-- CreateEnum
CREATE TYPE "NamePresence" AS ENUM ('allowed', 'required');

-- CreateEnum
CREATE TYPE "AttributePresence" AS ENUM ('required', 'optional', 'excluded');

-- AlterTable
ALTER TABLE "profile_extended_key_usages" ADD COLUMN     "state" "UsageState" NOT NULL DEFAULT 'forced';

-- AlterTable
ALTER TABLE "profile_key_usages" ADD COLUMN     "state" "UsageState" NOT NULL DEFAULT 'forced';

-- AlterTable
ALTER TABLE "profile_name_types" ADD COLUMN     "presence" "NamePresence" NOT NULL DEFAULT 'allowed';

-- AlterTable
ALTER TABLE "profile_versions" ADD COLUMN     "min_names" INTEGER NOT NULL DEFAULT 0;
-- A version that required a name requires at least one.
UPDATE "profile_versions" SET "min_names" = 1 WHERE "require_san";
ALTER TABLE "profile_versions" DROP COLUMN "require_san";

-- CreateTable
CREATE TABLE "profile_subject_attributes" (
    "profile_version_id" UUID NOT NULL,
    "oid" TEXT NOT NULL,
    "presence" "AttributePresence" NOT NULL,
    "default_value" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "pattern" TEXT,
    "max_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "profile_subject_attributes_pkey" PRIMARY KEY ("profile_version_id","oid")
);

-- CreateTable
CREATE TABLE "profile_name_policies" (
    "id" SERIAL NOT NULL,
    "profile_version_id" UUID NOT NULL,
    "type" "NameType" NOT NULL,
    "kind" "NameConstraintKind" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "profile_name_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_key_algorithms" (
    "profile_version_id" UUID NOT NULL,
    "algorithm" "KeyAlgorithm" NOT NULL,

    CONSTRAINT "profile_key_algorithms_pkey" PRIMARY KEY ("profile_version_id","algorithm")
);

-- CreateTable
CREATE TABLE "profile_csr_hashes" (
    "profile_version_id" UUID NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "profile_csr_hashes_pkey" PRIMARY KEY ("profile_version_id","hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_name_policies_profile_version_id_type_kind_value_key" ON "profile_name_policies"("profile_version_id", "type", "kind", "value");

-- AddForeignKey
ALTER TABLE "profile_subject_attributes" ADD CONSTRAINT "profile_subject_attributes_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_name_policies" ADD CONSTRAINT "profile_name_policies_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_key_algorithms" ADD CONSTRAINT "profile_key_algorithms_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_csr_hashes" ADD CONSTRAINT "profile_csr_hashes_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- What a subject could hold until now, for every version: a common name,
-- required; an organizational unit and an organization, optional (the
-- organization still the configured one when none is given).
INSERT INTO "profile_subject_attributes" ("profile_version_id", "oid", "presence")
SELECT "id", '2.5.4.3', 'required'::"AttributePresence" FROM "profile_versions"
UNION ALL SELECT "id", '2.5.4.11', 'optional'::"AttributePresence" FROM "profile_versions"
UNION ALL SELECT "id", '2.5.4.10', 'optional'::"AttributePresence" FROM "profile_versions";
