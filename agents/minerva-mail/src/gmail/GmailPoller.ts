import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { gmailConfig, type GmailConfigType } from "../config/configuration";
import { GmailPoll } from "./GmailPoll";

/**
 * Polls every linked mailbox's history while the agent runs, every
 * MAIL_GMAIL_POLL_SECONDS, one poll at a time: the next waits for the last
 * to finish, so a reconcile it falls back to never overlaps another. Off
 * when Gmail's client is not configured or the interval is 0.
 */
@Injectable()
export class GmailPoller
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(GmailPoller.name);
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private running?: Promise<void>;

  constructor(
    @Inject(gmailConfig.KEY) private readonly config: GmailConfigType,
    private readonly poll: GmailPoll,
  ) {}

  get intervalMs(): number {
    return this.config.clientId && this.config.pollSeconds
      ? this.config.pollSeconds * 1000
      : 0;
  }

  onApplicationBootstrap(): void {
    if (!this.intervalMs) {
      this.logger.log("Gmail history polling is off");
      return;
    }
    this.logger.log(
      `Polling linked mailboxes' Gmail history every ${this.intervalMs / 1000} s`,
    );
    this.schedule(5_000);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }

  /** One round over every linked mailbox; never throws. */
  async tick(): Promise<void> {
    try {
      await this.poll.pollAll();
    } catch (error) {
      this.logger.warn(
        `Polling Gmail failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.running = this.tick().finally(() => {
        this.running = undefined;
        this.schedule(this.intervalMs);
      });
    }, delayMs);
    this.timer.unref?.();
  }
}
