import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaEventOverrideStore } from "../../../../src/store/prisma/prisma-event-override-store";
import { PrismaService } from "../../../../src/store/prisma/prisma.service";
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

describe("PrismaEventOverrideStore", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaEventOverrideStore;

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
    await prisma.eventOverride.deleteMany();
    store = new PrismaEventOverrideStore(prisma);
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  it("returns null for an event with no override", async () => {
    expect(await store.getOverride("source:unknown")).toBeNull();
  });

  it("sets, gets, and clears an override", async () => {
    await store.setOverride("source:a", "busy");
    expect(await store.getOverride("source:a")).toEqual({
      eventId: "source:a",
      status: "busy",
    });

    await store.clearOverride("source:a");
    expect(await store.getOverride("source:a")).toBeNull();
  });

  it("setOverride replaces an existing override rather than erroring", async () => {
    await store.setOverride("source:a", "busy");
    await store.setOverride("source:a", "free");
    expect(await store.getOverride("source:a")).toEqual({
      eventId: "source:a",
      status: "free",
    });
  });

  it("clearOverride on an event with no override is a harmless no-op", async () => {
    await expect(
      store.clearOverride("source:never-set"),
    ).resolves.toBeUndefined();
  });

  it("listOverrides returns only the requested ids that have an override", async () => {
    await store.setOverride("source:a", "busy");
    await store.setOverride("source:b", "interruptable");
    await store.setOverride("source:c", "none");

    const result = await store.listOverrides([
      "source:a",
      "source:b",
      "source:missing",
    ]);
    expect(result.sort((x, y) => x.eventId.localeCompare(y.eventId))).toEqual([
      { eventId: "source:a", status: "busy" },
      { eventId: "source:b", status: "interruptable" },
    ]);
  });

  it("listOverrides returns an empty array for an empty id list", async () => {
    expect(await store.listOverrides([])).toEqual([]);
  });

  it("persists an override for an id with no corresponding Event row — overrides have no FK to Event", async () => {
    // Simulates surviving a full wipe-and-re-sync of the Event table: the
    // override must not depend on the Event row existing at all.
    await store.setOverride("source:never-synced", "busy");
    expect(await store.getOverride("source:never-synced")).toEqual({
      eventId: "source:never-synced",
      status: "busy",
    });
  });
});
