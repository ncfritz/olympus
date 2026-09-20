import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaCalendarColorStore } from "../../../../src/store/prisma/PrismaCalendarColorStore";
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

describe("PrismaCalendarColorStore", () => {
  let tempDir: string;
  let prisma: PrismaService;
  let store: PrismaCalendarColorStore;

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
    await prisma.calendarColor.deleteMany();
    store = new PrismaCalendarColorStore(prisma);
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  it("listColors returns an empty map when nothing is stored", async () => {
    expect(await store.listColors()).toEqual({});
  });

  it("setColor creates a new entry and listColors reflects it", async () => {
    await store.setColor("personal-gmail", "#1677ff");
    expect(await store.listColors()).toEqual({ "personal-gmail": "#1677ff" });
  });

  it("setColor overwrites an existing entry for the same source", async () => {
    await store.setColor("personal-gmail", "#1677ff");
    await store.setColor("personal-gmail", "#f5222d");
    expect(await store.listColors()).toEqual({ "personal-gmail": "#f5222d" });
  });

  it("listColors returns colors for multiple sources, including non-calendar pseudo-sources", async () => {
    await store.setColor("personal-gmail", "#1677ff");
    await store.setColor("Overrides", "#f5222d");
    expect(await store.listColors()).toEqual({
      "personal-gmail": "#1677ff",
      Overrides: "#f5222d",
    });
  });
});
