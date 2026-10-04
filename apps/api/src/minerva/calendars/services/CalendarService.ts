import type {
  AvailableCalendar,
  Calendar,
  PartialCalendar,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  toAvailableCalendar,
  toCalendar,
} from "../converters/CalendarConverter";
import type { GraphQlCalendarAccount } from "../converters/CalendarConverter";
import { CalendarAccountService } from "./CalendarAccountService";
import {
  type AgentCalendar,
  type AgentProvider,
  MinervaCalendarAgentClient,
} from "./MinervaCalendarAgentClient";

const notFound = (calendarId: string) =>
  new NotFoundException(`Calendar with id ${calendarId} not found`);

/**
 * The calendars of the user's accounts that the sync agent keeps in
 * Minerva (ADR 0028). The agent holds them; the user sees and changes only
 * those of their own accounts.
 */
@Injectable()
export class CalendarService {
  constructor(
    private readonly accounts: CalendarAccountService,
    private readonly agent: MinervaCalendarAgentClient,
  ) {}

  /** Every synced calendar of the user's accounts. */
  async list(userId: string): Promise<Calendar[]> {
    const owned = await this.accounts.owned(userId);
    const calendars = await this.agent.listCalendars();
    return calendars.flatMap((calendar) => {
      const account = accountOf(calendar, owned);
      return account ? [toCalendar(calendar, account.id)] : [];
    });
  }

  /** The calendars the account's provider reports. @throws NotFoundException */
  async listAvailable(
    userId: string,
    accountId: string,
  ): Promise<AvailableCalendar[]> {
    const account = await this.accounts.requireOwned(userId, accountId);
    const available = await this.agent.listAvailableCalendars(
      account.provider as AgentProvider,
      account.email,
    );
    return available.map(toAvailableCalendar);
  }

  /**
   * Starts syncing a calendar of one of the user's accounts. A source
   * another calendar has is a 409 from the agent.
   * @throws NotFoundException, BadRequestException
   */
  async add(
    userId: string,
    accountId: string,
    calendarId: unknown,
    source: unknown,
  ): Promise<Calendar> {
    const problems: string[] = [];
    const id = typeof calendarId === "string" ? calendarId.trim() : "";
    if (!id) problems.push("calendarId is required");
    const label = typeof source === "string" ? source.trim() : "";
    if (!label || label.length > 64) {
      problems.push("source must be 1 to 64 characters");
    }
    // `primary` is an alias at Google; synced, it would collide with every
    // other account's primary calendar. The real ID comes from the list.
    if (id === "primary") {
      problems.push(
        "calendarId must be the calendar's own ID from ListAvailableCalendars, not primary",
      );
    }
    if (problems.length) throw new BadRequestException(problems);

    const account = await this.accounts.requireOwned(userId, accountId);
    const created = await this.agent.createCalendar({
      provider: account.provider as AgentProvider,
      accountLabel: account.email,
      calendarId: id,
      source: label,
    });
    return toCalendar(created, account.id);
  }

  /** @throws NotFoundException for a calendar not of the user's accounts */
  async update(
    userId: string,
    calendarId: string,
    changes: PartialCalendar,
  ): Promise<Calendar> {
    const problems: string[] = [];
    for (const key of ["enabled", "includedInBusy"] as const) {
      if (changes[key] !== undefined && typeof changes[key] !== "boolean") {
        problems.push(`${key} must be true or false`);
      }
    }
    if (problems.length) throw new BadRequestException(problems);
    const { account } = await this.requireOwnedCalendar(userId, calendarId);
    const updated = await this.agent.updateCalendar(calendarId, {
      ...(changes.enabled !== undefined ? { enabled: changes.enabled } : {}),
      ...(changes.includedInBusy !== undefined
        ? { includedInBusy: changes.includedInBusy }
        : {}),
    });
    return toCalendar(updated, account.id);
  }

  /** Stops syncing a calendar; its meetings stay. @throws NotFoundException */
  async remove(userId: string, calendarId: string): Promise<void> {
    await this.requireOwnedCalendar(userId, calendarId);
    await this.agent.deleteCalendar(calendarId);
  }

  private async requireOwnedCalendar(
    userId: string,
    calendarId: string,
  ): Promise<{ calendar: AgentCalendar; account: GraphQlCalendarAccount }> {
    const owned = await this.accounts.owned(userId);
    const calendar = (await this.agent.listCalendars()).find(
      (c) => c.calendarId === calendarId,
    );
    const account = calendar ? accountOf(calendar, owned) : undefined;
    if (!calendar || !account) throw notFound(calendarId);
    return { calendar, account };
  }
}

/** The user's account a calendar syncs through, if it is theirs. */
const accountOf = (
  calendar: AgentCalendar,
  owned: GraphQlCalendarAccount[],
): GraphQlCalendarAccount | undefined =>
  owned.find(
    (a) =>
      a.provider === calendar.provider && a.email === calendar.accountLabel,
  );
