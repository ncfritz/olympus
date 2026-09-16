import { execSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PrismaEventStore } from "../../../../src/store/prisma/prisma-event-store";
import { PrismaService } from "../../../../src/store/prisma/prisma.service";
import { testPrismaEventStoreContract } from "../../../support/prisma-event-store.contract";

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
    store = new PrismaEventStore(prisma);
  });

  afterEach(async () => {
    await prisma.onModuleDestroy();
  });

  testPrismaEventStoreContract(() => store);
});
