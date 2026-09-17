-- CreateTable
CREATE TABLE "SyncedCalendar" (
    "calendarId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountLabel" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "enablePush" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncedCalendar_pkey" PRIMARY KEY ("calendarId")
);
