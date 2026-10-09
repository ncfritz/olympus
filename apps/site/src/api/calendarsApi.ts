import {
  addCalendar,
  type AvailableCalendar,
  type Calendar,
  type CalendarAccount,
  type CalendarAccountClaim,
  type CalendarProvider,
  client,
  confirmCalendarAccountClaim,
  connectCalendarAccount,
  createCalendarAccountClaim,
  describeCalendarAccountClaim,
  listAvailableCalendars,
  listCalendarAccounts,
  listCalendars,
  reauthorizeCalendarAccount,
  removeCalendar,
  removeCalendarAccount,
  updateCalendar,
} from "@ncfritz/olympus-sdk/minerva";

/**
 * The signed-in user's calendar accounts and calendars through the API
 * (ADR 0028): connecting, re-authorizing and claiming accounts, and the
 * calendars the sync agent keeps in Minerva.
 */
class CalendarsApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async listAccounts(): Promise<CalendarAccount[]> {
    const { data } = await listCalendarAccounts();
    return data.calendarAccounts;
  }

  /** The provider's sign-in page; the browser comes back to `returnTo`. */
  async connect(provider: CalendarProvider, returnTo: string): Promise<string> {
    const { data } = await connectCalendarAccount({
      body: { connection: { provider, returnTo } },
    });
    return data.signIn.authUrl;
  }

  async reauthorize(accountId: string, returnTo: string): Promise<string> {
    const { data } = await reauthorizeCalendarAccount({
      path: { accountId },
      body: { reauthorization: { returnTo } },
    });
    return data.signIn.authUrl;
  }

  async removeAccount(accountId: string): Promise<void> {
    await removeCalendarAccount({ path: { accountId } });
  }

  async listCalendars(): Promise<Calendar[]> {
    const { data } = await listCalendars();
    return data.calendars;
  }

  async listAvailable(accountId: string): Promise<AvailableCalendar[]> {
    const { data } = await listAvailableCalendars({ path: { accountId } });
    return data.availableCalendars;
  }

  async addCalendar(
    accountId: string,
    calendarId: string,
    source: string,
  ): Promise<Calendar> {
    const { data } = await addCalendar({
      path: { accountId },
      body: { calendar: { calendarId, source } },
    });
    return data.calendar;
  }

  async updateCalendar(
    calendarId: string,
    changes: { enabled?: boolean; includedInBusy?: boolean; color?: string },
  ): Promise<Calendar> {
    const { data } = await updateCalendar({
      path: { calendarId },
      body: { calendar: changes },
    });
    return data.calendar;
  }

  async removeCalendar(calendarId: string): Promise<void> {
    await removeCalendar({ path: { calendarId } });
  }

  async claim(email: string, confirmPage: string): Promise<void> {
    await createCalendarAccountClaim({
      body: { claim: { email, confirmPage } },
    });
  }

  async describeClaim(token: string): Promise<CalendarAccountClaim> {
    const { data } = await describeCalendarAccountClaim({ path: { token } });
    return data.claim;
  }

  async confirmClaim(token: string): Promise<CalendarAccount> {
    const { data } = await confirmCalendarAccountClaim({ path: { token } });
    return data.calendarAccount;
  }
}

const calendarsApi = new CalendarsApi();

export default calendarsApi;
