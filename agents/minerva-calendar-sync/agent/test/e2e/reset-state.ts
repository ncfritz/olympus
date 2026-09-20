import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach } from "vitest";

// Each e2e file has its own SQLite database (env-setup.ts), but the tests
// in a file share it. Synced calendars (seeded with seedCalendar(), see
// calendar-fixtures.ts) and calendar colors are wiped before each test so
// one test's rows don't show up in the next one's assertions.
const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.syncedCalendar.deleteMany();
  await prisma.calendarColor.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
