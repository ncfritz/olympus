import { Injectable } from "@nestjs/common";
import type { CalendarEventAccount } from "@ncfritz/olympus-messages";
import { GoogleCredentialStore } from "../../providers/google/GoogleCredentialStore";
import { MicrosoftCredentialStore } from "../../providers/microsoft/MicrosoftCredentialStore";
import { SyncConfigService } from "../../sync/services/SyncConfigService";

/**
 * The account a calendar's events came through, named by provider and
 * subject (ADR 0028), for the messages OutboxDispatcherService publishes.
 * Resolved when a message is sent rather than when its row is written, so
 * rows queued before subjects were recorded carry an account too; a
 * calendar's account never changes, so the two are the same answer.
 */
@Injectable()
export class EventAccountResolver {
  constructor(
    private readonly config: SyncConfigService,
    private readonly google: GoogleCredentialStore,
    private readonly microsoft: MicrosoftCredentialStore,
  ) {}

  /** Undefined when the calendar is no longer synced or its account has no subject recorded. */
  async forSource(source: string): Promise<CalendarEventAccount | undefined> {
    const calendar = (await this.config.getAll()).find(
      (c) => c.source === source,
    );
    if (!calendar) return undefined;
    const store =
      calendar.provider === "microsoft" ? this.microsoft : this.google;
    const subject = store.tryLoad(calendar.accountLabel)?.subject;
    return subject ? { provider: calendar.provider, subject } : undefined;
  }
}
