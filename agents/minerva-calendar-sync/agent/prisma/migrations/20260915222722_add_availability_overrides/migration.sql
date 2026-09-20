-- CreateTable
CREATE TABLE "EventOverride" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OverrideBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "OverrideBlock_startTime_endTime_idx" ON "OverrideBlock"("startTime", "endTime");
