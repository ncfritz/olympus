/*
  Warnings:

  - Added the required column `source` to the `OutboxEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "source" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "OutboxEvent_source_status_idx" ON "OutboxEvent"("source", "status");
