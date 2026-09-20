-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "importance" TEXT NOT NULL,
    "occurrenceType" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reminder" BOOLEAN NOT NULL,
    "response" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "allDay" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "organizerEmail" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "calendarId" TEXT NOT NULL,
    "syncToken" TEXT,
    "channelId" TEXT,
    "resourceId" TEXT,
    "channelExpiration" TIMESTAMP(3),
    "channelToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("calendarId")
);

-- CreateTable
CREATE TABLE "EventOverride" (
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOverride_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "OverrideBlock" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverrideBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_source_deleted_idx" ON "Event"("source", "deleted");

-- CreateIndex
CREATE UNIQUE INDEX "Event_source_uid_key" ON "Event"("source", "uid");

-- CreateIndex
CREATE INDEX "OverrideBlock_startTime_endTime_idx" ON "OverrideBlock"("startTime", "endTime");
