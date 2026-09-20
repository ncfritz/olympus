import { Injectable } from "@nestjs/common";
import moment from "moment";
import type {
  AvailableCalendar,
  CalendarAccount,
  CalendarAccountAuthorization,
  CalendarAccountReauthorization,
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

  listAvailableCalendars(
    accountLabel: string,
    provider?: CalendarProviderName,
  ): Promise<AvailableCalendar[]> {
    return this.calendarAuth.listAvailableCalendars(accountLabel, provider);
  }
}
