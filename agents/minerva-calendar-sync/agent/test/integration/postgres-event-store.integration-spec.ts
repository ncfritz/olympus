import { PrismaEventStore } from "../../src/store/prisma/PrismaEventStore";
import { PrismaService } from "../../src/store/prisma/PrismaService";
import { testPrismaEventStoreContract } from "../support/prisma-event-store.contract";
import { afterEach, beforeEach, describe } from "vitest";

// Runs the exact same behavioral contract as
// test/unit/store/prisma/prisma-event-store.spec.ts, but against a real
// Postgres database (see env-setup.ts) instead of a disposable SQLite
// file — the point is to prove the two dialects actually agree, not to
// re-describe the same behavior twice. Requires `docker compose up -d
// postgres` and the client regenerated from the Postgres schema first;
// `npm run test:integration` does both for you.
describe("PrismaEventStore (Postgres)", () => {
  let prisma: PrismaService;
  let store: PrismaEventStore;

  beforeEach(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await prisma.event.deleteMany();
    await prisma.syncState.deleteMany();
    await prisma.outboxEvent.deleteMany();
    store = new PrismaEventStore(prisma, true);
  });

  afterEach(async () => {
    await prisma.onApplicationShutdown();
  });

  testPrismaEventStoreContract(
    () => store,
    () => prisma,
  );
});
