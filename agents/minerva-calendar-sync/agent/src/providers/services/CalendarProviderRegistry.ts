import { Inject, Injectable } from "@nestjs/common";
import {
  microsoftConfig,
  type MicrosoftConfigType,
} from "../../config/configuration";
import { SyncedCalendarConfig } from "../../sync/syncedCalendarConfig";
import { CalendarProvider } from "../calendarProvider";
import { GoogleCalendarProvider } from "../google/GoogleCalendarProvider";
import { GoogleCredentialStore } from "../google/GoogleCredentialStore";
import { MicrosoftCalendarProvider } from "../microsoft/MicrosoftCalendarProvider";
import { MicrosoftCredentialStore } from "../microsoft/MicrosoftCredentialStore";
import { createAuthorizedMicrosoftClient } from "../microsoft/microsoftOauth";

/** Resolves the right CalendarProvider instance for a configured calendar, caching by account. */
@Injectable()
export class CalendarProviderRegistry {
  private readonly googleProviders = new Map<string, GoogleCalendarProvider>();
  private readonly microsoftProviders = new Map<
    string,
    MicrosoftCalendarProvider
  >();

  constructor(
    private readonly googleCredentials: GoogleCredentialStore,
    private readonly microsoftCredentials: MicrosoftCredentialStore,
    @Inject(microsoftConfig.KEY)
    private readonly microsoft: MicrosoftConfigType,
  ) {}

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
        this.googleCredentials.createAuthorizedClient(accountLabel),
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
        createAuthorizedMicrosoftClient(
          this.microsoft,
          this.microsoftCredentials,
          accountLabel,
        ),
      );
      this.microsoftProviders.set(accountLabel, provider);
    }
    return provider;
  }
}
