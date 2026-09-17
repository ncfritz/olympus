-- CreateTable
CREATE TABLE "CalendarColor" (
    "source" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarColor_pkey" PRIMARY KEY ("source")
);
