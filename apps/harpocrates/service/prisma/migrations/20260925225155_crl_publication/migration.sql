-- CreateEnum
CREATE TYPE "CrlSource" AS ENUM ('signed', 'ceremony', 'imported');

-- AlterTable
ALTER TABLE "crls" ADD COLUMN     "ceremony_id" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "entries" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_attempt_at" TIMESTAMP(3),
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "publish_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "source" "CrlSource" NOT NULL DEFAULT 'signed';

-- AlterTable
ALTER TABLE "issuers" ADD COLUMN     "certificate_published_at" TIMESTAMP(3),
ADD COLUMN     "crl_due_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "imported_revocations" (
    "id" SERIAL NOT NULL,
    "issuer_id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3) NOT NULL,
    "reason" "RevocationReason" NOT NULL,
    "crl_number" BIGINT NOT NULL,

    CONSTRAINT "imported_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imported_revocations_issuer_id_serial_key" ON "imported_revocations"("issuer_id", "serial");

-- CreateIndex
CREATE INDEX "crls_issuer_id_published_at_idx" ON "crls"("issuer_id", "published_at");

-- AddForeignKey
ALTER TABLE "crls" ADD CONSTRAINT "crls_ceremony_id_fkey" FOREIGN KEY ("ceremony_id") REFERENCES "ceremonies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_revocations" ADD CONSTRAINT "imported_revocations_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
