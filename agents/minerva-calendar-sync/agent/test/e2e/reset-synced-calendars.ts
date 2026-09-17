import { PrismaClient } from "@prisma/client";

// Synced calendars are now entirely DB-backed (no more ephemeral,
// per-app-instance env config) — so unlike the rest of e2e state, fixtures
// seeded with seedCalendar() (see calendar-fixtures.ts) persist in the same
// SQLite file across every test in a file, not just within one. Wiping the
// table before each test keeps that fixture data from leaking between
// tests that happen to reuse a calendarId/accountLabel, the same isolation
// a fresh env var used to give for free.
const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.syncedCalendar.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
