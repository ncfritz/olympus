-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "occurrenceType" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reminder" BOOLEAN NOT NULL,
    "response" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "allDay" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "organizerEmail" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncState" (
    "calendarId" TEXT NOT NULL PRIMARY KEY,
    "syncToken" TEXT,
    "channelId" TEXT,
    "resourceId" TEXT,
    "channelExpiration" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Event_source_deleted_idx" ON "Event"("source", "deleted");

-- CreateIndex
CREATE UNIQUE INDEX "Event_source_uid_key" ON "Event"("source", "uid");
