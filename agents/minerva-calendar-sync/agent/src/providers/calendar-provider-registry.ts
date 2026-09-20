import { Injectable } from "@nestjs/common";
import { SyncedCalendarConfig } from "../sync/synced-calendar-config";
import { CalendarProvider } from "./calendar-provider";
import { GoogleCalendarProvider } from "./google/google-calendar-provider";
import { createAuthorizedGoogleClient } from "./google/google-credential-store";
import { MicrosoftCalendarProvider } from "./microsoft/microsoft-calendar-provider";
import { createAuthorizedMicrosoftClient } from "./microsoft/microsoft-oauth";

/** Resolves the right CalendarProvider instance for a configured calendar, caching by account. */
@Injectable()
export class CalendarProviderRegistry {
  private readonly googleProviders = new Map<string, GoogleCalendarProvider>();
  private readonly microsoftProviders = new Map<
    string,
    MicrosoftCalendarProvider
  >();

  resolve(config: SyncedCalendarConfig): CalendarProvider {
    switch (config.provider) {
      case "google":
        return this.getGoogleProvider(config.accountLabel);
      case "microsoft":
        return this.getMicrosoftProvider(config.accountLabel);
      default:
        throw new Error(`Unsupported provider "${config.provider}"`);
    }
  }

  /** Resolves a provider bound to just an account — for calendar discovery, before any specific calendar is configured. */
  forAccount(
    accountLabel: string,
    provider: SyncedCalendarConfig["provider"],
  ): CalendarProvider {
    switch (provider) {
      case "google":
        return this.getGoogleProvider(accountLabel);
      case "microsoft":
        return this.getMicrosoftProvider(accountLabel);
      default:
        throw new Error(`Unsupported provider "${provider}"`);
    }
  }

  private getGoogleProvider(accountLabel: string): GoogleCalendarProvider {
    let provider = this.googleProviders.get(accountLabel);
    if (!provider) {
      provider = new GoogleCalendarProvider(
        createAuthorizedGoogleClient(accountLabel),
      );
      this.googleProviders.set(accountLabel, provider);
    }
    return provider;
  }

  private getMicrosoftProvider(
    accountLabel: string,
  ): MicrosoftCalendarProvider {
    let provider = this.microsoftProviders.get(accountLabel);
    if (!provider) {
      provider = new MicrosoftCalendarProvider(
        createAuthorizedMicrosoftClient(accountLabel),
      );
      this.microsoftProviders.set(accountLabel, provider);
    }
    return provider;
  }
}
