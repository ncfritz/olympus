import { Injectable } from "@nestjs/common";
import { SyncedCalendarConfig } from "../sync/synced-calendar-config";
import { CalendarProvider } from "./calendar-provider";
import { GoogleCalendarProvider } from "./google/google-calendar-provider";
import { createAuthorizedGoogleClient } from "./google/google-credential-store";

/** Resolves the right CalendarProvider instance for a configured calendar, caching by account. */
@Injectable()
export class CalendarProviderRegistry {
  private readonly googleProviders = new Map<string, GoogleCalendarProvider>();

  resolve(config: SyncedCalendarConfig): CalendarProvider {
    switch (config.provider) {
      case "google":
        return this.getGoogleProvider(config.accountLabel);
      default:
        throw new Error(`Unsupported provider "${config.provider}"`);
    }
  }

  private getGoogleProvider(accountLabel: string): GoogleCalendarProvider {
    let provider = this.googleProviders.get(accountLabel);
    if (!provider) {
      provider = new GoogleCalendarProvider(createAuthorizedGoogleClient(accountLabel));
      this.googleProviders.set(accountLabel, provider);
    }
    return provider;
  }
}
