-- CreateTable
CREATE TABLE "CalendarBusyInclusion" (
    "calendarId" TEXT NOT NULL PRIMARY KEY,
    "includedInBusy" BOOLEAN NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
