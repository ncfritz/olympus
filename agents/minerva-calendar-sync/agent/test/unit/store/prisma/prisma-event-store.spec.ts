import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaEventStore } from "../../../../src/store/prisma/prisma-event-store";
import { PrismaService } from "../../../../src/store/prisma/prisma.service";
import { testPrismaEventStoreContract } from "../../../support/prisma-event-store.contract";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

const API_ROOT = join(__dirname, "..", "..", "..", "..");

describe("PrismaEventStore (SQLite)", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaEventStore;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "minerva-test-"));
    process.env.DATABASE_URL = `file:${join(tempDir, "test.db")}`;
    execSync("npx prisma db push --skip-generate", {
      cwd: API_ROOT,
      env: process.env,
      stdio: "pipe",
    });
  }, 30000);

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await prisma.event.deleteMany();
    await prisma.syncState.deleteMany();
    await prisma.outboxEvent.deleteMany();
    store = new PrismaEventStore(prisma, true);
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  testPrismaEventStoreContract(
    () => store,
    () => prisma,
  );

  it("writes no outbox rows at all when outbound sync isn't configured", async () => {
    const disabledStore = new PrismaEventStore(prisma, false);
    const event = {
      id: "personal-gmail:uid-disabled",
      subject: "Team sync",
      sensitivity: "normal" as const,
      importance: "normal" as const,
      occurrenceType: "single" as const,
      type: "meeting" as const,
      reminder: true,
      response: "accepted" as const,
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:30:00.000Z",
      duration: 30,
      allDay: false,
      status: "busy" as const,
      location: null,
      cancelled: false,
      organizerEmail: null,
      deleted: false,
      uid: "uid-disabled",
      recurrenceId: null,
      recurrenceRule: null,
      source: "personal-gmail",
    };

    await disabledStore.upsertEvent(event);
    await disabledStore.upsertEvent({ ...event, subject: "Renamed" });
    await disabledStore.markCancelled(event.source, event.uid);
    await disabledStore.markDeleted(event.source, event.uid);

    expect(await prisma.outboxEvent.count()).toBe(0);
  });
});
