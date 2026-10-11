-- Profiles as versioned presets (ADR 0034), behaviour-preserving: every
-- setting moves to profile_versions, and each profile today becomes v1 of
-- itself; its rules, enrollments and certificates point at that version.

-- CreateTable
CREATE TABLE "profile_versions" (
    "id" UUID NOT NULL,
    "profile_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "issuer_id" TEXT,
    "issuer_purpose" TEXT NOT NULL,
    "key_algorithm" "KeyAlgorithm" NOT NULL,
    "validity_days" INTEGER NOT NULL,
    "renew_at_days" INTEGER NOT NULL,
    "max_key_age_days" INTEGER NOT NULL,
    "allow_csr" BOOLEAN NOT NULL,
    "allow_generated" BOOLEAN NOT NULL,
    "legacy_export" BOOLEAN NOT NULL DEFAULT false,
    "require_san" BOOLEAN NOT NULL,
    "escrow" BOOLEAN NOT NULL DEFAULT true,
    "escrow_overridable" BOOLEAN NOT NULL DEFAULT false,
    "extensions" "ExtensionSet" NOT NULL DEFAULT 'standard',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_versions_profile_id_version_key" ON "profile_versions"("profile_id", "version");

-- Each profile, as v1 of itself.
INSERT INTO "profile_versions" ("id", "profile_id", "version", "issuer_id", "issuer_purpose", "key_algorithm", "validity_days", "renew_at_days", "max_key_age_days", "allow_csr", "allow_generated", "legacy_export", "require_san", "escrow", "escrow_overridable", "extensions", "created_by", "updated_at")
SELECT gen_random_uuid(), "id", 1, "issuer_id", "issuer_purpose", "key_algorithm", "validity_days", "renew_at_days", "max_key_age_days", "allow_csr", "allow_generated", "legacy_export", "require_san", "escrow", "escrow_overridable", "extensions", 'migration', CURRENT_TIMESTAMP
FROM "profiles";

-- The rules, onto the version.
ALTER TABLE "profile_key_usages" DROP CONSTRAINT "profile_key_usages_profile_id_fkey";
ALTER TABLE "profile_key_usages" DROP CONSTRAINT "profile_key_usages_pkey";
ALTER TABLE "profile_key_usages" ADD COLUMN "profile_version_id" UUID;
UPDATE "profile_key_usages" r SET "profile_version_id" = v."id" FROM "profile_versions" v WHERE v."profile_id" = r."profile_id";
ALTER TABLE "profile_key_usages" ALTER COLUMN "profile_version_id" SET NOT NULL;
ALTER TABLE "profile_key_usages" DROP COLUMN "profile_id";
ALTER TABLE "profile_key_usages" ADD CONSTRAINT "profile_key_usages_pkey" PRIMARY KEY ("profile_version_id", "usage");

ALTER TABLE "profile_extended_key_usages" DROP CONSTRAINT "profile_extended_key_usages_profile_id_fkey";
ALTER TABLE "profile_extended_key_usages" DROP CONSTRAINT "profile_extended_key_usages_pkey";
ALTER TABLE "profile_extended_key_usages" ADD COLUMN "profile_version_id" UUID;
UPDATE "profile_extended_key_usages" r SET "profile_version_id" = v."id" FROM "profile_versions" v WHERE v."profile_id" = r."profile_id";
ALTER TABLE "profile_extended_key_usages" ALTER COLUMN "profile_version_id" SET NOT NULL;
ALTER TABLE "profile_extended_key_usages" DROP COLUMN "profile_id";
ALTER TABLE "profile_extended_key_usages" ADD CONSTRAINT "profile_extended_key_usages_pkey" PRIMARY KEY ("profile_version_id", "oid");

ALTER TABLE "profile_name_types" DROP CONSTRAINT "profile_name_types_profile_id_fkey";
ALTER TABLE "profile_name_types" DROP CONSTRAINT "profile_name_types_pkey";
ALTER TABLE "profile_name_types" ADD COLUMN "profile_version_id" UUID;
UPDATE "profile_name_types" r SET "profile_version_id" = v."id" FROM "profile_versions" v WHERE v."profile_id" = r."profile_id";
ALTER TABLE "profile_name_types" ALTER COLUMN "profile_version_id" SET NOT NULL;
ALTER TABLE "profile_name_types" DROP COLUMN "profile_id";
ALTER TABLE "profile_name_types" ADD CONSTRAINT "profile_name_types_pkey" PRIMARY KEY ("profile_version_id", "type");

-- Enrollments and certificates, onto v1 of their profile.
ALTER TABLE "enrollments" ADD COLUMN "profile_version_id" UUID;
UPDATE "enrollments" e SET "profile_version_id" = v."id" FROM "profile_versions" v WHERE v."profile_id" = e."profile_id";
ALTER TABLE "enrollments" ALTER COLUMN "profile_version_id" SET NOT NULL;

ALTER TABLE "certificates" ADD COLUMN "profile_version_id" UUID;
UPDATE "certificates" c SET "profile_version_id" = v."id" FROM "profile_versions" v WHERE v."profile_id" = c."profile_id";

-- The profile keeps its slug, description and kind; it gains its dates.
ALTER TABLE "profiles" DROP CONSTRAINT "profiles_issuer_id_fkey";
ALTER TABLE "profiles" DROP COLUMN "issuer_id",
DROP COLUMN "issuer_purpose",
DROP COLUMN "key_algorithm",
DROP COLUMN "validity_days",
DROP COLUMN "renew_at_days",
DROP COLUMN "max_key_age_days",
DROP COLUMN "allow_csr",
DROP COLUMN "allow_generated",
DROP COLUMN "legacy_export",
DROP COLUMN "require_san",
DROP COLUMN "escrow",
DROP COLUMN "escrow_overridable",
DROP COLUMN "extensions",
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "deactivated_at" TIMESTAMP(3);
ALTER TABLE "profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "profile_key_usages" ADD CONSTRAINT "profile_key_usages_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_extended_key_usages" ADD CONSTRAINT "profile_extended_key_usages_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_name_types" ADD CONSTRAINT "profile_name_types_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
