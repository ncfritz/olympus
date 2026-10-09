-- CreateEnum
CREATE TYPE "IssuerTier" AS ENUM ('root', 'intermediate', 'issuing');

-- CreateEnum
CREATE TYPE "IssuerStatus" AS ENUM ('pending', 'active', 'closed', 'revoked');

-- CreateEnum
CREATE TYPE "NameConstraintKind" AS ENUM ('permitted', 'excluded');

-- CreateEnum
CREATE TYPE "NameType" AS ENUM ('dns', 'ip', 'email', 'uri');

-- CreateEnum
CREATE TYPE "KeyAlgorithm" AS ENUM ('P-256', 'RSA-2048');

-- CreateEnum
CREATE TYPE "KeyPurpose" AS ENUM ('issuer', 'subject');

-- CreateEnum
CREATE TYPE "KeyLocation" AS ENUM ('signer', 'subscriber', 'offline');

-- CreateEnum
CREATE TYPE "EnrollmentMode" AS ENUM ('csr', 'generated');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('valid', 'revoked');

-- CreateEnum
CREATE TYPE "RevocationReason" AS ENUM ('unspecified', 'keyCompromise', 'cACompromise', 'affiliationChanged', 'superseded', 'cessationOfOperation', 'privilegeWithdrawn');

-- CreateTable
CREATE TABLE "issuers" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "tier" "IssuerTier" NOT NULL,
    "status" "IssuerStatus" NOT NULL,
    "purpose" TEXT,
    "number" INTEGER NOT NULL,
    "generation" INTEGER NOT NULL,
    "parent_id" TEXT,
    "external" BOOLEAN NOT NULL DEFAULT false,
    "key_id" UUID NOT NULL,
    "certificate" BYTEA,
    "csr" BYTEA,
    "serial" TEXT,
    "not_before" TIMESTAMP(3),
    "not_after" TIMESTAMP(3),
    "path_length" INTEGER,
    "max_validity_days" INTEGER NOT NULL,
    "crl_url" TEXT NOT NULL,
    "ca_issuers_url" TEXT NOT NULL,
    "next_crl_number" BIGINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuer_extended_key_usages" (
    "issuer_id" TEXT NOT NULL,
    "oid" TEXT NOT NULL,

    CONSTRAINT "issuer_extended_key_usages_pkey" PRIMARY KEY ("issuer_id","oid")
);

-- CreateTable
CREATE TABLE "issuer_name_constraints" (
    "id" SERIAL NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "kind" "NameConstraintKind" NOT NULL,
    "type" "NameType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "issuer_name_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ceremonies" (
    "id" TEXT NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "ceremonies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
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

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_key_usages" (
    "profile_id" TEXT NOT NULL,
    "usage" TEXT NOT NULL,

    CONSTRAINT "profile_key_usages_pkey" PRIMARY KEY ("profile_id","usage")
);

-- CreateTable
CREATE TABLE "profile_extended_key_usages" (
    "profile_id" TEXT NOT NULL,
    "oid" TEXT NOT NULL,

    CONSTRAINT "profile_extended_key_usages_pkey" PRIMARY KEY ("profile_id","oid")
);

-- CreateTable
CREATE TABLE "profile_name_types" (
    "profile_id" TEXT NOT NULL,
    "type" "NameType" NOT NULL,

    CONSTRAINT "profile_name_types_pkey" PRIMARY KEY ("profile_id","type")
);

-- CreateTable
CREATE TABLE "keys" (
    "id" UUID NOT NULL,
    "spki_sha256" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "algorithm" TEXT NOT NULL,
    "purpose" "KeyPurpose" NOT NULL,
    "location" "KeyLocation" NOT NULL,
    "signer_key_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destroyed_at" TIMESTAMP(3),
    "blocked_at" TIMESTAMP(3),

    CONSTRAINT "keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "profile_id" TEXT NOT NULL,
    "mode" "EnrollmentMode" NOT NULL,
    "subject" TEXT NOT NULL,
    "csr" BYTEA,
    "replaces_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollment_names" (
    "id" SERIAL NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "type" "NameType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "enrollment_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "enrollment_id" UUID,
    "profile_id" TEXT,
    "subject" TEXT NOT NULL,
    "not_before" TIMESTAMP(3) NOT NULL,
    "not_after" TIMESTAMP(3) NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'valid',
    "der" BYTEA NOT NULL,
    "renews_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revocations" (
    "certificate_id" UUID NOT NULL,
    "reason" "RevocationReason" NOT NULL,
    "comment" TEXT,
    "principal" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revocations_pkey" PRIMARY KEY ("certificate_id")
);

-- CreateTable
CREATE TABLE "crls" (
    "id" SERIAL NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "number" BIGINT NOT NULL,
    "this_update" TIMESTAMP(3) NOT NULL,
    "next_update" TIMESTAMP(3) NOT NULL,
    "der" BYTEA NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "crls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escrow_exports" (
    "id" SERIAL NOT NULL,
    "key_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "format" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escrow_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "sequence" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "principal" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "subject_type" TEXT,
    "subject_id" TEXT,
    "reason" TEXT,
    "previous_hash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("sequence")
);

-- CreateTable
CREATE TABLE "audit_event_attributes" (
    "event_sequence" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "audit_event_attributes_pkey" PRIMARY KEY ("event_sequence","name")
);

-- CreateIndex
CREATE UNIQUE INDEX "issuers_subject_key" ON "issuers"("subject");

-- CreateIndex
CREATE UNIQUE INDEX "issuers_key_id_key" ON "issuers"("key_id");

-- CreateIndex
CREATE UNIQUE INDEX "issuers_purpose_tier_number_generation_key" ON "issuers"("purpose", "tier", "number", "generation");

-- CreateIndex
CREATE UNIQUE INDEX "issuer_name_constraints_issuer_id_kind_type_value_key" ON "issuer_name_constraints"("issuer_id", "kind", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "keys_spki_sha256_key" ON "keys"("spki_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "keys_signer_key_id_key" ON "keys"("signer_key_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_key_id_key" ON "enrollments"("key_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_replaces_id_key" ON "enrollments"("replaces_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_names_enrollment_id_type_value_key" ON "enrollment_names"("enrollment_id", "type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_renews_id_key" ON "certificates"("renews_id");

-- CreateIndex
CREATE INDEX "certificates_not_after_idx" ON "certificates"("not_after");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_issuer_id_serial_key" ON "certificates"("issuer_id", "serial");

-- CreateIndex
CREATE UNIQUE INDEX "crls_issuer_id_number_key" ON "crls"("issuer_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_hash_key" ON "audit_events"("hash");

-- CreateIndex
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_subject_type_subject_id_idx" ON "audit_events"("subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "issuers" ADD CONSTRAINT "issuers_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "issuers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuers" ADD CONSTRAINT "issuers_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuer_extended_key_usages" ADD CONSTRAINT "issuer_extended_key_usages_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issuer_name_constraints" ADD CONSTRAINT "issuer_name_constraints_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ceremonies" ADD CONSTRAINT "ceremonies_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_key_usages" ADD CONSTRAINT "profile_key_usages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_extended_key_usages" ADD CONSTRAINT "profile_extended_key_usages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_name_types" ADD CONSTRAINT "profile_name_types_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_replaces_id_fkey" FOREIGN KEY ("replaces_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment_names" ADD CONSTRAINT "enrollment_names_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_renews_id_fkey" FOREIGN KEY ("renews_id") REFERENCES "certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revocations" ADD CONSTRAINT "revocations_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crls" ADD CONSTRAINT "crls_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_exports" ADD CONSTRAINT "escrow_exports_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escrow_exports" ADD CONSTRAINT "escrow_exports_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event_attributes" ADD CONSTRAINT "audit_event_attributes_event_sequence_fkey" FOREIGN KEY ("event_sequence") REFERENCES "audit_events"("sequence") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The audit log is append-only: nothing updates or deletes an event.
CREATE FUNCTION audit_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

CREATE TRIGGER audit_event_attributes_append_only
  BEFORE UPDATE OR DELETE ON "audit_event_attributes"
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

-- The initial profiles (ADR 0020, Profiles). Issuers are pinned once the
-- CAs exist; until then a profile issues from the active issuing CA of
-- its purpose.
INSERT INTO "profiles" ("id", "description", "issuer_purpose", "key_algorithm", "validity_days", "renew_at_days", "max_key_age_days", "allow_csr", "allow_generated", "legacy_export", "require_san") VALUES
  ('service',       'Service identities (mTLS clients): CN = app name, OU = deployment', 'Service', 'P-256',    365,  243, 730, true,  true,  false, false),
  ('api-server',    'The API''s 3443 listener',                                       'Service', 'P-256',    365,  243, 730, true,  true,  false, true),
  ('device',        'People''s devices, as PKCS#12 for iOS profiles and browsers',   'Device',  'P-256',    365,  243, 730, false, true,  false, false),
  ('internal-tls',  'Server certificates for internal hosts',                         'TLS',     'P-256',    90,   60,  730, true,  true,  false, true),
  ('legacy-device', 'The printer: RSA, legacy PKCS#12 without the chain',             'TLS',     'RSA-2048', 365,  243, 730, false, true,  true,  true),
  ('code-signing',  'Code signing; re-sign what it signed before it expires',         'Signing', 'P-256',    730,  548, 730, true,  false, false, false),
  ('email',         'S/MIME signing and encryption; escrowed, since a lost key loses mail', 'Signing', 'P-256', 730, 548, 730, false, true, false, true),
  ('document',      'Document signing (RFC 9336); re-sign before it expires',          'Signing', 'P-256',    730,  548, 730, true,  true,  false, false);

INSERT INTO "profile_key_usages" ("profile_id", "usage") VALUES
  ('service', 'digital_signature'),
  ('api-server', 'digital_signature'),
  ('device', 'digital_signature'),
  ('internal-tls', 'digital_signature'),
  ('legacy-device', 'digital_signature'),
  ('legacy-device', 'key_encipherment'),
  ('code-signing', 'digital_signature'),
  ('email', 'digital_signature'),
  ('email', 'key_encipherment'),
  ('document', 'digital_signature'),
  ('document', 'content_commitment');

-- serverAuth 1.3.6.1.5.5.7.3.1, clientAuth .2, codeSigning .3,
-- emailProtection .4, documentSigning .36 (RFC 9336).
INSERT INTO "profile_extended_key_usages" ("profile_id", "oid") VALUES
  ('service', '1.3.6.1.5.5.7.3.1'),
  ('service', '1.3.6.1.5.5.7.3.2'),
  ('api-server', '1.3.6.1.5.5.7.3.1'),
  ('api-server', '1.3.6.1.5.5.7.3.2'),
  ('device', '1.3.6.1.5.5.7.3.2'),
  ('internal-tls', '1.3.6.1.5.5.7.3.1'),
  ('legacy-device', '1.3.6.1.5.5.7.3.1'),
  ('code-signing', '1.3.6.1.5.5.7.3.3'),
  ('email', '1.3.6.1.5.5.7.3.4'),
  ('document', '1.3.6.1.5.5.7.3.36');

INSERT INTO "profile_name_types" ("profile_id", "type") VALUES
  ('service', 'dns'),
  ('api-server', 'dns'),
  ('api-server', 'ip'),
  ('internal-tls', 'dns'),
  ('internal-tls', 'ip'),
  ('legacy-device', 'dns'),
  ('legacy-device', 'ip'),
  ('email', 'email');
