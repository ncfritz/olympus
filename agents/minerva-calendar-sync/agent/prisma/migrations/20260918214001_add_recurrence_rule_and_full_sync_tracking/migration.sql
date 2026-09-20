-- AlterTable
ALTER TABLE "Event" ADD COLUMN "recurrenceRule" TEXT;

-- AlterTable
ALTER TABLE "SyncState" ADD COLUMN "lastFullSyncAt" DATETIME;
