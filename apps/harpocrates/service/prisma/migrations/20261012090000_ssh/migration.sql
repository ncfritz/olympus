-- SSH certificates (ADR 0035, phase 9 step 2): SSH CAs, profiles of the
-- ssh kind with their own settings, and the identity-to-principals
-- mapping. ssh-user and ssh-host are seeded as v1 of themselves; an SSH
-- version's X.509 columns hold what an SSH certificate does not use.

-- CreateEnum
CREATE TYPE "ProfileKind" AS ENUM ('x509', 'ssh');

-- CreateEnum
CREATE TYPE "SshCertificateType" AS ENUM ('user', 'host');

-- CreateEnum
CREATE TYPE "SshCaStatus" AS ENUM ('active', 'retired');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "kind" "ProfileKind" NOT NULL DEFAULT 'x509';

-- CreateTable
CREATE TABLE "ssh_cas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SshCertificateType" NOT NULL,
    "number" INTEGER NOT NULL,
    "generation" INTEGER NOT NULL,
    "status" "SshCaStatus" NOT NULL DEFAULT 'active',
    "key_id" UUID NOT NULL,
    "public_key" TEXT NOT NULL,
    "max_validity_hours" INTEGER NOT NULL,
    "krl_url" TEXT NOT NULL,
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssh_cas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_ssh_settings" (
    "profile_version_id" UUID NOT NULL,
    "certificate_type" "SshCertificateType" NOT NULL,
    "ssh_ca_id" TEXT,
    "validity_hours" INTEGER NOT NULL,
    "renew_at_hours" INTEGER NOT NULL,
    "force_command" TEXT,

    CONSTRAINT "profile_ssh_settings_pkey" PRIMARY KEY ("profile_version_id")
);

-- CreateTable
CREATE TABLE "profile_ssh_source_addresses" (
    "id" SERIAL NOT NULL,
    "profile_version_id" UUID NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "profile_ssh_source_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_ssh_extensions" (
    "profile_version_id" UUID NOT NULL,
    "extension" TEXT NOT NULL,

    CONSTRAINT "profile_ssh_extensions_pkey" PRIMARY KEY ("profile_version_id","extension")
);

-- CreateTable
CREATE TABLE "ssh_principal_mappings" (
    "id" SERIAL NOT NULL,
    "identity" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssh_principal_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ssh_cas_name_key" ON "ssh_cas"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ssh_cas_key_id_key" ON "ssh_cas"("key_id");

-- CreateIndex
CREATE UNIQUE INDEX "ssh_cas_type_number_generation_key" ON "ssh_cas"("type", "number", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "profile_ssh_source_addresses_profile_version_id_value_key" ON "profile_ssh_source_addresses"("profile_version_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "ssh_principal_mappings_identity_principal_key" ON "ssh_principal_mappings"("identity", "principal");

-- AddForeignKey
ALTER TABLE "ssh_cas" ADD CONSTRAINT "ssh_cas_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_ssh_settings" ADD CONSTRAINT "profile_ssh_settings_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_ssh_settings" ADD CONSTRAINT "profile_ssh_settings_ssh_ca_id_fkey" FOREIGN KEY ("ssh_ca_id") REFERENCES "ssh_cas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_ssh_source_addresses" ADD CONSTRAINT "profile_ssh_source_addresses_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_ssh_extensions" ADD CONSTRAINT "profile_ssh_extensions_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed: ADR 0020's ssh-user (16 hours) and ssh-host (90 days, renewed at
-- 60), the subscriber's key submitted, never generated or escrowed.
INSERT INTO "profiles" ("id", "kind", "description", "updated_at") VALUES
  ('ssh-user', 'ssh', 'SSH user certificates: log in as one''s mapped principals', CURRENT_TIMESTAMP),
  ('ssh-host', 'ssh', 'SSH host certificates: a host''s names, vouched for', CURRENT_TIMESTAMP);

INSERT INTO "profile_versions" ("id", "profile_id", "version", "issuer_purpose", "key_algorithm", "validity_days", "renew_at_days", "max_key_age_days", "allow_csr", "allow_generated", "escrow", "created_by", "updated_at") VALUES
  (gen_random_uuid(), 'ssh-user', 1, 'SSH User', 'Ed25519', 1, 1, 365, true, false, false, 'migration', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ssh-host', 1, 'SSH Host', 'Ed25519', 90, 60, 3650, true, false, false, 'migration', CURRENT_TIMESTAMP);

INSERT INTO "profile_ssh_settings" ("profile_version_id", "certificate_type", "validity_hours", "renew_at_hours")
SELECT "id", CASE "profile_id" WHEN 'ssh-user' THEN 'user'::"SshCertificateType" ELSE 'host'::"SshCertificateType" END,
       CASE "profile_id" WHEN 'ssh-user' THEN 16 ELSE 2160 END,
       CASE "profile_id" WHEN 'ssh-user' THEN 12 ELSE 1440 END
FROM "profile_versions" WHERE "profile_id" IN ('ssh-user', 'ssh-host');

INSERT INTO "profile_ssh_extensions" ("profile_version_id", "extension")
SELECT "id", e FROM "profile_versions", unnest(ARRAY['permit-pty', 'permit-port-forwarding']) AS e
WHERE "profile_id" = 'ssh-user';
