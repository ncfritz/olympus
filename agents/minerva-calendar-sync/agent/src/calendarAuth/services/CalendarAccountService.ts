import { Injectable } from "@nestjs/common";
import moment from "moment";
import type {
  AvailableCalendar,
  BaseCalendarAccountWebSignIn,
  CalendarAccount,
  CalendarAccountAuthorization,
  CalendarAccountReauthorization,
  CalendarAccountWebSignInCallback,
  CalendarAccountWebSignInResult,
} from "../../model/calendarAccounts";
import type { CalendarAccountStatus } from "../types";
import { CalendarAuthService } from "./CalendarAuthService";

type CalendarProviderName = "google" | "microsoft";

const toMoment = (value: string | undefined) =>
  value ? moment.utc(value) : undefined;

const toCalendarAccount = (status: CalendarAccountStatus): CalendarAccount => ({
  ...status,
  obtainedAt: toMoment(status.obtainedAt),
  accessTokenExpiresAt: toMoment(status.accessTokenExpiresAt),
});

/** The management API over CalendarAuthService: calendar accounts and their sign-ins. */
@Injectable()
export class CalendarAccountService {
  constructor(private readonly calendarAuth: CalendarAuthService) {}

  async list(): Promise<CalendarAccount[]> {
    const statuses = await this.calendarAuth.listStatuses();
    return statuses.map(toCalendarAccount);
  }

  async createAuthorization(
    provider: CalendarProviderName,
  ): Promise<CalendarAccountAuthorization> {
    const { transactionId, authUrl } =
      await this.calendarAuth.startNewAccountAuth(provider);
    return { authorizationId: transactionId, status: "pending", authUrl };
  }

  describeAuthorization(authorizationId: string): CalendarAccountAuthorization {
    return {
      authorizationId,
      ...this.calendarAuth.getNewAccountAuthStatus(authorizationId),
    };
  }

  reauthorize(
    accountLabel: string,
    provider?: CalendarProviderName,
  ): Promise<CalendarAccountReauthorization> {
    return this.calendarAuth.startReauth(accountLabel, provider);
  }

  startWebSignIn(start: BaseCalendarAccountWebSignIn): Promise<string> {
    return this.calendarAuth.startWebSignIn(start.provider, {
      redirectUri: start.redirectUri,
      state: start.state,
      codeChallenge: start.codeChallenge,
      loginHint: start.accountLabel,
    });
  }

  async completeWebSignIn(
    callback: CalendarAccountWebSignInCallback,
  ): Promise<CalendarAccountWebSignInResult> {
    const result = await this.calendarAuth.completeWebSignIn(
      callback.provider,
      callback,
    );
    return { provider: callback.provider, ...result };
  }

  remove(accountLabel: string, provider: CalendarProviderName): Promise<void> {
    return this.calendarAuth.removeAccount(accountLabel, provider);
  }

  listAvailableCalendars(
    accountLabel: string,
    provider?: CalendarProviderName,
  ): Promise<AvailableCalendar[]> {
    return this.calendarAuth.listAvailableCalendars(accountLabel, provider);
  }
}
