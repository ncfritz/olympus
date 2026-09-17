-- CreateTable
CREATE TABLE "CalendarEnablement" (
    "calendarId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEnablement_pkey" PRIMARY KEY ("calendarId")
);
