import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaOverrideBlockStore } from "../../../../src/store/prisma/PrismaOverrideBlockStore";
import { PrismaService } from "../../../../src/store/prisma/PrismaService";
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

describe("PrismaOverrideBlockStore", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaOverrideBlockStore;

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
    await prisma.overrideBlock.deleteMany();
    store = new PrismaOverrideBlockStore(prisma);
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  it("creates a block and assigns it an id", async () => {
    const block = await store.create({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T16:00:00.000Z",
      status: "busy",
      label: "Focus time",
    });
    expect(block.id).toBeTruthy();
    expect(block).toMatchObject({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T16:00:00.000Z",
      status: "busy",
      label: "Focus time",
    });
  });

  it("listOverlapping finds blocks that overlap the range and excludes ones that don't", async () => {
    const overlapping = await store.create({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:30:00.000Z",
      status: "busy",
      label: null,
    });
    await store.create({
      startTime: "2026-01-05T18:00:00.000Z",
      endTime: "2026-01-05T19:00:00.000Z",
      status: "busy",
      label: null,
    });

    const result = await store.listOverlapping(
      "2026-01-05T15:15:00.000Z",
      "2026-01-05T16:00:00.000Z",
    );
    expect(result.map((b) => b.id)).toEqual([overlapping.id]);
  });

  it("listOverlapping excludes a block that ends exactly at the range start", async () => {
    await store.create({
      startTime: "2026-01-05T14:00:00.000Z",
      endTime: "2026-01-05T15:00:00.000Z",
      status: "busy",
      label: null,
    });

    const result = await store.listOverlapping(
      "2026-01-05T15:00:00.000Z",
      "2026-01-05T16:00:00.000Z",
    );
    expect(result).toEqual([]);
  });

  it("deletes a block", async () => {
    const block = await store.create({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:30:00.000Z",
      status: "busy",
      label: null,
    });

    await store.delete(block.id);
    expect(
      await store.listOverlapping(
        "2026-01-01T00:00:00.000Z",
        "2026-01-06T00:00:00.000Z",
      ),
    ).toEqual([]);
  });

  it("deleting an unknown id is a harmless no-op", async () => {
    await expect(store.delete("does-not-exist")).resolves.toBeUndefined();
  });

  it("updateStatus changes the status of an existing block in place", async () => {
    const block = await store.create({
      startTime: "2026-01-05T15:00:00.000Z",
      endTime: "2026-01-05T15:30:00.000Z",
      status: "busy",
      label: "Focus time",
    });

    const updated = await store.updateStatus(block.id, "free");
    expect(updated).toMatchObject({
      id: block.id,
      status: "free",
      label: "Focus time",
    });
  });

  it("updateStatus returns null for an unknown id", async () => {
    expect(await store.updateStatus("does-not-exist", "free")).toBeNull();
  });
});
