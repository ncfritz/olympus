import type { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import type { OutboxEvent } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutboxDispatcherService } from "../../../../src/outbox/services/OutboxDispatcherService";
import type { PrismaService } from "../../../../src/store/prisma/PrismaService";
import { testConfig } from "../../../support/config";

const row = (overrides: Partial<OutboxEvent> = {}): OutboxEvent => ({
  id: "outbox-1",
  eventId: "work:uid-1",
  source: "work",
  action: "upsert",
  payload: JSON.stringify({ id: "work:uid-1", subject: "Planning" }),
  status: "pending",
  attempts: 0,
  lastError: null,
  availableAt: new Date(),
  createdAt: new Date(),
  sentAt: null,
  ...overrides,
});

describe("OutboxDispatcherService", () => {
  const outbox = testConfig().outbox;
  let publish: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let rows: OutboxEvent[];
  let dispatcher: OutboxDispatcherService;

  beforeEach(() => {
    vi.useFakeTimers();
    rows = [];
    publish = vi.fn().mockResolvedValue(true);
    update = vi.fn().mockResolvedValue({});
    const prisma = {
      outboxEvent: {
        findMany: vi.fn(async () => rows.splice(0)),
        update,
      },
    };
    dispatcher = new OutboxDispatcherService(
      { publish } as unknown as AmqpConnection,
      prisma as unknown as PrismaService,
      outbox,
    );
    dispatcher.onModuleInit();
  });

  afterEach(() => {
    dispatcher.onModuleDestroy();
    vi.useRealTimers();
  });

  const tick = () => vi.advanceTimersByTimeAsync(outbox.pollIntervalMs);

  it.each(["upsert", "delete", "backfill"])(
    "publishes a %s row as event.<action> on calendar.events",
    async (action) => {
      rows.push(row({ action }));
      await tick();

      expect(publish).toHaveBeenCalledWith(
        "calendar.events",
        `event.${action}`,
        { id: "work:uid-1", subject: "Planning" },
        { messageId: "outbox-1" },
      );
      expect(update).toHaveBeenCalledWith({
        where: { id: "outbox-1" },
        data: { status: "sent", sentAt: expect.any(Date) },
      });
    },
  );

  it("backs a failed publish off and records the error", async () => {
    publish.mockRejectedValueOnce(new Error("broker down"));
    rows.push(row({ attempts: 1 }));
    await tick();

    expect(update).toHaveBeenCalledWith({
      where: { id: "outbox-1" },
      data: {
        attempts: 2,
        lastError: "broker down",
        availableAt: expect.any(Date),
      },
    });
  });

  it("gives up after the last attempt", async () => {
    publish.mockRejectedValueOnce(new Error("broker down"));
    rows.push(row({ attempts: outbox.maxAttempts - 1 }));
    await tick();

    expect(update).toHaveBeenCalledWith({
      where: { id: "outbox-1" },
      data: {
        status: "failed",
        attempts: outbox.maxAttempts,
        lastError: "broker down",
      },
    });
  });
});
