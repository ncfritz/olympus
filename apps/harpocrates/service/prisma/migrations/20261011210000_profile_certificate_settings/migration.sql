-- A version's certificate settings (ADR 0034, phase 10 step 4),
-- behaviour-preserving: every version keeps SHA-256, PKCS#1 v1.5, the
-- SHA-1 key identifiers, critical basic constraints and both
-- distribution URLs, no issuer alternative name, policies or custom
-- extensions. Certificates may name a UPN or registeredID; a CA may have
-- alternative names for its leaves to carry.

-- CreateEnum
CREATE TYPE "CertificateHash" AS ENUM ('sha256', 'sha384', 'sha512');

-- CreateEnum
CREATE TYPE "RsaPadding" AS ENUM ('pkcs1v15', 'pss');

-- CreateEnum
CREATE TYPE "KeyIdentifierMethod" AS ENUM ('sha1', 'sha256', 'none');

-- CreateEnum
CREATE TYPE "AuthorityKeyIdentifierForm" AS ENUM ('key_id', 'key_id_and_issuer', 'none');

-- CreateEnum
CREATE TYPE "BasicConstraintsForm" AS ENUM ('critical', 'non_critical', 'omitted');

-- AlterEnum (PostgreSQL 16 adds both in one migration)
ALTER TYPE "NameType" ADD VALUE 'upn';
ALTER TYPE "NameType" ADD VALUE 'registeredId';

-- AlterTable
ALTER TABLE "profile_versions" ADD COLUMN     "authority_key_identifier" "AuthorityKeyIdentifierForm" NOT NULL DEFAULT 'key_id',
ADD COLUMN     "basic_constraints" "BasicConstraintsForm" NOT NULL DEFAULT 'critical',
ADD COLUMN     "include_ca_issuers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "include_crl_distribution" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "include_issuer_alt_name" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rsa_padding" "RsaPadding" NOT NULL DEFAULT 'pkcs1v15',
ADD COLUMN     "signature_hash" "CertificateHash" NOT NULL DEFAULT 'sha256',
ADD COLUMN     "subject_key_identifier" "KeyIdentifierMethod" NOT NULL DEFAULT 'sha1';

-- CreateTable
CREATE TABLE "issuer_alternative_names" (
    "id" SERIAL NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "type" "NameType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "issuer_alternative_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_policies" (
    "id" SERIAL NOT NULL,
    "profile_version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "oid" TEXT NOT NULL,
    "cps_uri" TEXT,
    "user_notice" TEXT,

    CONSTRAINT "profile_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_custom_extensions" (
    "id" SERIAL NOT NULL,
    "profile_version_id" UUID NOT NULL,
    "oid" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "value" BYTEA NOT NULL,

    CONSTRAINT "profile_custom_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "issuer_alternative_names_issuer_id_type_value_key" ON "issuer_alternative_names"("issuer_id", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "profile_policies_profile_version_id_oid_key" ON "profile_policies"("profile_version_id", "oid");

-- CreateIndex
CREATE UNIQUE INDEX "profile_custom_extensions_profile_version_id_oid_key" ON "profile_custom_extensions"("profile_version_id", "oid");

-- AddForeignKey
ALTER TABLE "issuer_alternative_names" ADD CONSTRAINT "issuer_alternative_names_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_policies" ADD CONSTRAINT "profile_policies_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_custom_extensions" ADD CONSTRAINT "profile_custom_extensions_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

