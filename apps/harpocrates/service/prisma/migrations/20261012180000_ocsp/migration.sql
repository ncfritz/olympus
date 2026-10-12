-- OCSP (ADR 0036): each CA's responder, a certificate for an `ocsp` key in
-- the signer, and the responses it signs ahead for every certificate of
-- its CA, kept and served until their nextUpdate.

-- CreateEnum
CREATE TYPE "OcspResponderStatus" AS ENUM ('active', 'superseded');

-- CreateEnum
CREATE TYPE "OcspCertIdHash" AS ENUM ('sha1', 'sha256');

-- CreateEnum
CREATE TYPE "OcspCertStatus" AS ENUM ('good', 'revoked');

-- AlterEnum
ALTER TYPE "KeyPurpose" ADD VALUE 'ocsp';

-- CreateTable
CREATE TABLE "ocsp_responders" (
    "id" UUID NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "key_id" UUID NOT NULL,
    "serial" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "certificate" BYTEA NOT NULL,
    "not_before" TIMESTAMP(3) NOT NULL,
    "not_after" TIMESTAMP(3) NOT NULL,
    "status" "OcspResponderStatus" NOT NULL DEFAULT 'active',
    "ceremony_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocsp_responders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocsp_responses" (
    "id" UUID NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "hash" "OcspCertIdHash" NOT NULL,
    "status" "OcspCertStatus" NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "reason" "RevocationReason",
    "responder_id" UUID NOT NULL,
    "der" BYTEA NOT NULL,
    "this_update" TIMESTAMP(3) NOT NULL,
    "next_update" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocsp_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ocsp_responders_key_id_key" ON "ocsp_responders"("key_id");

-- CreateIndex
CREATE INDEX "ocsp_responders_issuer_id_status_idx" ON "ocsp_responders"("issuer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ocsp_responders_issuer_id_serial_key" ON "ocsp_responders"("issuer_id", "serial");

-- CreateIndex
CREATE INDEX "ocsp_responses_next_update_idx" ON "ocsp_responses"("next_update");

-- CreateIndex
CREATE UNIQUE INDEX "ocsp_responses_issuer_id_serial_hash_key" ON "ocsp_responses"("issuer_id", "serial", "hash");

-- AddForeignKey
ALTER TABLE "ocsp_responders" ADD CONSTRAINT "ocsp_responders_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocsp_responders" ADD CONSTRAINT "ocsp_responders_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocsp_responders" ADD CONSTRAINT "ocsp_responders_ceremony_id_fkey" FOREIGN KEY ("ceremony_id") REFERENCES "ceremonies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocsp_responses" ADD CONSTRAINT "ocsp_responses_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocsp_responses" ADD CONSTRAINT "ocsp_responses_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "ocsp_responders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

