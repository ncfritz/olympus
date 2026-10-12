-- Hosts renewing their SSH certificates by signing a challenge with
-- their host key (ADR 0035, phase 9 step 4).

-- CreateTable
CREATE TABLE "ssh_renewal_challenges" (
    "id" UUID NOT NULL,
    "ssh_certificate_id" UUID NOT NULL,
    "nonce" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssh_renewal_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ssh_renewal_challenges_nonce_key" ON "ssh_renewal_challenges"("nonce");

-- AddForeignKey
ALTER TABLE "ssh_renewal_challenges" ADD CONSTRAINT "ssh_renewal_challenges_ssh_certificate_id_fkey" FOREIGN KEY ("ssh_certificate_id") REFERENCES "ssh_certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

