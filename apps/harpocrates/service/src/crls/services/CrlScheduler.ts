import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { crlConfig, type CrlConfigType } from "../../config/configuration";
import { crlSigningFailures } from "../../metrics/pkiMetrics";
import { CrlService } from "./CrlService";
import { type Publication, PublicationService } from "./PublicationService";

export type SchedulerRun = {
  signed: { issuerId: string; number: number }[];
  failed: { issuerId: string; reason: string; message: string }[];
  published: Publication[];
};

const reasonOf = (error: unknown) =>
  error instanceof ServiceUnavailableException
    ? "sealed"
    : error instanceof UnprocessableEntityException
      ? "refused"
      : "error";

/**
 * Keeps the lists current: every CRL_SCHEDULE_SECONDS it signs what is
 * due and publishes what is not out yet, and a revocation or an imported
 * list runs it at once. While the signer is sealed each run fails and the
 * next tries again, so a missed list is signed as soon as it unseals.
 * One instance runs it; the CLI and the tests turn it off.
 */
@Injectable()
export class CrlScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(CrlScheduler.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private again = false;
  private sealedLogged = false;

  constructor(
    private readonly crls: CrlService,
    private readonly publication: PublicationService,
    @Inject(crlConfig.KEY) private readonly config: CrlConfigType,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.scheduleSeconds === 0) return;
    this.timer = setInterval(
      () => void this.kick(),
      this.config.scheduleSeconds * 1000,
    );
    void this.kick();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  /** A run now, or one straight after the run in progress; off when the schedule is. */
  kick(): Promise<void> {
    if (this.config.scheduleSeconds === 0) return Promise.resolve();
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        try {
          await this.run();
        } catch (error: unknown) {
          this.logger.error(`The list run failed: ${String(error)}`);
        }
      } while (this.again);
    })().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  /** One pass: sign what is due, then publish what is not out. */
  async run(now = new Date()): Promise<SchedulerRun> {
    const result: SchedulerRun = { signed: [], failed: [], published: [] };
    for (const issuer of await this.crls.due(now)) {
      try {
        const crl = await this.crls.signOnline(issuer);
        result.signed.push({ issuerId: issuer.id, number: crl.number });
        this.sealedLogged = false;
      } catch (error: unknown) {
        const reason = reasonOf(error);
        const message =
          error instanceof HttpException || error instanceof Error
            ? error.message
            : String(error);
        crlSigningFailures.inc({ issuer: issuer.id, reason });
        result.failed.push({ issuerId: issuer.id, reason, message });
        if (reason === "sealed") {
          if (!this.sealedLogged) {
            this.logger.warn(
              `Lists are due but the signer is sealed: ${message}`,
            );
            this.sealedLogged = true;
          }
          // Every other issuer would fail the same way.
          break;
        }
        this.logger.error(`Signing ${issuer.id}'s list failed: ${message}`);
      }
    }
    result.published = await this.publication.publishPending(now);
    return result;
  }
}
