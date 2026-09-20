-- CreateTable
CREATE TABLE "CalendarBusyInclusion" (
    "calendarId" TEXT NOT NULL,
    "includedInBusy" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarBusyInclusion_pkey" PRIMARY KEY ("calendarId")
);
