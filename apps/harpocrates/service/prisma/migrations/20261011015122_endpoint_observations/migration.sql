-- CreateEnum
CREATE TYPE "EndpointResult" AS ENUM ('current', 'previous', 'other', 'unreachable');

-- AlterTable: a target made before endpoints is checked at its name on 443,
-- as a new one is by default.
ALTER TABLE "deploy_targets" ADD COLUMN "endpoint" TEXT;
UPDATE "deploy_targets" SET "endpoint" = "name" || ':443';
ALTER TABLE "deploy_targets" ALTER COLUMN "endpoint" SET NOT NULL;

-- CreateTable
CREATE TABLE "endpoint_observations" (
    "id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "result" "EndpointResult" NOT NULL,
    "expected_certificate_id" UUID NOT NULL,
    "served_certificate_id" UUID,
    "served_sha256" TEXT,
    "served_serial" TEXT,
    "served_subject" TEXT,
    "served_not_after" TIMESTAMP(3),
    "error" TEXT,
    "checks" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "endpoint_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "endpoint_observations_target_id_updated_at_idx" ON "endpoint_observations"("target_id", "updated_at");

-- AddForeignKey
ALTER TABLE "endpoint_observations" ADD CONSTRAINT "endpoint_observations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "deploy_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
