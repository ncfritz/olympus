-- CreateEnum
CREATE TYPE "DeployKind" AS ENUM ('host_path');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('pending', 'deployed', 'superseded');

-- CreateTable
CREATE TABLE "deploy_targets" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DeployKind" NOT NULL DEFAULT 'host_path',
    "certificate_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deploy_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "certificate_id" UUID NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'pending',
    "principal" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "deployed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deploy_targets_name_key" ON "deploy_targets"("name");

-- CreateIndex
CREATE INDEX "deployments_target_id_created_at_idx" ON "deployments"("target_id", "created_at");

-- CreateIndex
CREATE INDEX "deployments_status_idx" ON "deployments"("status");

-- AddForeignKey
ALTER TABLE "deploy_targets" ADD CONSTRAINT "deploy_targets_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "deploy_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_certificate_id_fkey" FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
