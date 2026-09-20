-- CreateTable
CREATE TABLE "SyncedCalendar" (
    "calendarId" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "enablePush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
