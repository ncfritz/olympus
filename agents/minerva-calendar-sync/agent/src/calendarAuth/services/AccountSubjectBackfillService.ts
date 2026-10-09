import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { GoogleAuthStrategy } from "../strategies/GoogleAuthStrategy";
import { MicrosoftAuthStrategy } from "../strategies/MicrosoftAuthStrategy";
import type { CalendarAuthStrategy } from "../strategies/calendarAuthStrategy";

/**
 * Records the subject of every stored account that lacks one: credentials
 * saved before subjects were kept (ADR 0028). Runs once after start-up, in
 * the background, so a slow provider never holds up the agent. An account
 * the provider gives no subject for is left as it is; its status asks for
 * a new sign-in.
 */
@Injectable()
export class AccountSubjectBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AccountSubjectBackfillService.name);
  private readonly strategies: CalendarAuthStrategy[];

  constructor(google: GoogleAuthStrategy, microsoft: MicrosoftAuthStrategy) {
    this.strategies = [google, microsoft];
  }

  onApplicationBootstrap(): void {
    void this.backfill();
  }

  /** Visible for tests: resolves once every account has been tried. */
  async backfill(): Promise<void> {
    for (const strategy of this.strategies) {
      for (const accountLabel of strategy.listStoredAccountLabels()) {
        if (strategy.tryLoadCredential(accountLabel)?.subject) continue;
        try {
          const subject = await strategy.recordSubject(accountLabel);
          if (subject) {
            this.logger.log(
              `Recorded the subject of ${strategy.provider} account "${accountLabel}"`,
            );
          } else {
            this.logger.warn(
              `${strategy.provider} gave no subject for "${accountLabel}"; it needs a new sign-in`,
            );
          }
        } catch (error) {
          this.logger.warn(
            `Could not read the subject of ${strategy.provider} account "${accountLabel}": ${strategy.errorMessage(error)}`,
          );
        }
      }
    }
  }
}
