-- SSH certificates and each SSH CA's KRL (ADR 0035, phase 9 step 3).

-- AlterTable
ALTER TABLE "ssh_cas" ADD COLUMN     "krl_due_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "krl_published_at" TIMESTAMP(3),
ADD COLUMN     "next_krl_number" BIGINT NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ssh_certificates" (
    "id" UUID NOT NULL,
    "ssh_ca_id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "profile_version_id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "type" "SshCertificateType" NOT NULL,
    "serial" TEXT NOT NULL,
    "key_identifier" TEXT NOT NULL,
    "identity" TEXT,
    "fingerprint" TEXT NOT NULL,
    "valid_after" TIMESTAMP(3) NOT NULL,
    "valid_before" TIMESTAMP(3) NOT NULL,
    "certificate" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'valid',
    "revoked_at" TIMESTAMP(3),
    "revocation_reason" "RevocationReason",
    "issued_by" TEXT NOT NULL,
    "renews_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssh_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ssh_certificate_principals" (
    "id" SERIAL NOT NULL,
    "ssh_certificate_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "principal" TEXT NOT NULL,

    CONSTRAINT "ssh_certificate_principals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ssh_certificates_renews_id_key" ON "ssh_certificates"("renews_id");

-- CreateIndex
CREATE INDEX "ssh_certificates_identity_idx" ON "ssh_certificates"("identity");

-- CreateIndex
CREATE UNIQUE INDEX "ssh_certificates_ssh_ca_id_serial_key" ON "ssh_certificates"("ssh_ca_id", "serial");

-- CreateIndex
CREATE UNIQUE INDEX "ssh_certificate_principals_ssh_certificate_id_principal_key" ON "ssh_certificate_principals"("ssh_certificate_id", "principal");

-- AddForeignKey
ALTER TABLE "ssh_certificates" ADD CONSTRAINT "ssh_certificates_ssh_ca_id_fkey" FOREIGN KEY ("ssh_ca_id") REFERENCES "ssh_cas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssh_certificates" ADD CONSTRAINT "ssh_certificates_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssh_certificates" ADD CONSTRAINT "ssh_certificates_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "profile_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssh_certificates" ADD CONSTRAINT "ssh_certificates_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssh_certificates" ADD CONSTRAINT "ssh_certificates_renews_id_fkey" FOREIGN KEY ("renews_id") REFERENCES "ssh_certificates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssh_certificate_principals" ADD CONSTRAINT "ssh_certificate_principals_ssh_certificate_id_fkey" FOREIGN KEY ("ssh_certificate_id") REFERENCES "ssh_certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

