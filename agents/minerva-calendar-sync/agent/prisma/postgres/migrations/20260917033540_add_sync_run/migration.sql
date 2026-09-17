-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "addedCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "deletedCount" INTEGER NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRunEventChange" (
    "id" TEXT NOT NULL,
    "syncRunId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),

    CONSTRAINT "SyncRunEventChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncRun_calendarId_startedAt_idx" ON "SyncRun"("calendarId", "startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "SyncRunEventChange_syncRunId_idx" ON "SyncRunEventChange"("syncRunId");

-- AddForeignKey
ALTER TABLE "SyncRunEventChange" ADD CONSTRAINT "SyncRunEventChange_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "SyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
