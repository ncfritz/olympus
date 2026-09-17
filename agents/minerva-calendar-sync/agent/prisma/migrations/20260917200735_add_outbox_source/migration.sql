/*
  Warnings:

  - Added the required column `source` to the `OutboxEvent` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OutboxEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME
);
INSERT INTO "new_OutboxEvent" ("action", "attempts", "availableAt", "createdAt", "eventId", "id", "lastError", "payload", "sentAt", "status") SELECT "action", "attempts", "availableAt", "createdAt", "eventId", "id", "lastError", "payload", "sentAt", "status" FROM "OutboxEvent";
DROP TABLE "OutboxEvent";
ALTER TABLE "new_OutboxEvent" RENAME TO "OutboxEvent";
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");
CREATE INDEX "OutboxEvent_source_status_idx" ON "OutboxEvent"("source", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
