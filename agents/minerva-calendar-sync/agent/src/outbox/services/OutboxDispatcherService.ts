import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import {
  outboxConfig,
  type OutboxConfigType,
} from "../../config/configuration";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  calendarEventRoute,
  publishMessage,
  type CalendarEventAction,
  type CalendarEventMessage,
} from "@ncfritz/olympus-messages";
import { OutboxEvent as OutboxRow } from "@prisma/client";
import { PrismaService } from "../../store/prisma/PrismaService";

const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 10 * 60_000;

/**
 * Drains the OutboxEvent table (written transactionally by PrismaEventStore
 * alongside every Event change) onto RabbitMQ, as the calendar event
 * messages of @ncfritz/olympus-messages. Polling rather than
 * publish-on-write: a row written while the dispatcher (or the broker) is
 * down is picked up on the next tick with no special recovery path, since
 * "pending row sitting in Postgres" already *is* the recovery state.
 *
 * Delivery is at-least-once, not exactly-once — a crash between the
 * broker's publisher-confirm ack (see AmqpConnection.publish) and this
 * marking the row "sent" redelivers it. Consumers are expected to upsert by
 * the event's (source, uid) key regardless, so this costs nothing extra.
 */
@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private readonly batchSize: number;
  private readonly pollIntervalMs: number;
  private readonly maxAttempts: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly amqp: AmqpConnection,
    private readonly prisma: PrismaService,
    @Inject(outboxConfig.KEY) outbox: OutboxConfigType,
  ) {
    this.batchSize = outbox.batchSize;
    this.pollIntervalMs = outbox.pollIntervalMs;
    this.maxAttempts = outbox.maxAttempts;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.tick().catch((error) =>
        this.logger.error(`Outbox dispatch tick failed: ${message(error)}`),
      );
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { status: "pending", availableAt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: this.batchSize,
    });

    // Sequential on purpose: ordered, in-order delivery per event matters
    // more here than raw throughput on what's expected to be a low-volume
    // personal calendar, and it keeps a burst of failures from hammering an
    // already-struggling broker.
    for (const row of rows) {
      await this.dispatchOne(row);
    }
  }

  private async dispatchOne(row: OutboxRow): Promise<void> {
    try {
      // Resolves only once the broker has confirmed the publish (AmqpConnection
      // publishes over a confirm channel internally) — that confirmation, not
      // just an unthrown call, is what makes marking this "sent" honest.
      await publishMessage(
        this.amqp,
        calendarEventRoute(row.action as CalendarEventAction),
        JSON.parse(row.payload) as CalendarEventMessage,
        { messageId: row.id },
      );
      await this.prisma.outboxEvent.update({
        where: { id: row.id },
        data: { status: "sent", sentAt: new Date() },
      });
    } catch (error) {
      await this.markFailed(row, error);
    }
  }

  private async markFailed(row: OutboxRow, error: unknown): Promise<void> {
    const attempts = row.attempts + 1;
    const lastError = message(error);

    if (attempts >= this.maxAttempts) {
      await this.prisma.outboxEvent.update({
        where: { id: row.id },
        data: { status: "failed", attempts, lastError },
      });
      this.logger.error(
        `Giving up on outbox row ${row.id} (event ${row.eventId}) after ${attempts} attempts: ${lastError}`,
      );
      return;
    }

    const backoffMs = Math.min(
      BASE_BACKOFF_MS * 2 ** row.attempts,
      MAX_BACKOFF_MS,
    );
    await this.prisma.outboxEvent.update({
      where: { id: row.id },
      data: {
        attempts,
        lastError,
        availableAt: new Date(Date.now() + backoffMs),
      },
    });
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
