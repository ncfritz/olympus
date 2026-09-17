-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calendarId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "addedCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "deletedCount" INTEGER NOT NULL,
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "SyncRunEventChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncRunId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "startTime" DATETIME,
    CONSTRAINT "SyncRunEventChange_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SyncRun_calendarId_startedAt_idx" ON "SyncRun"("calendarId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "SyncRunEventChange_syncRunId_idx" ON "SyncRunEventChange"("syncRunId");
