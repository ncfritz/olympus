import {
  type AvailableCalendar,
  type Calendar,
  type CalendarAccount,
  CalendarAccountStatus,
  type CalendarAccountVerification,
  type CalendarProvider,
} from "@ncfritz/olympus-model";
import moment from "moment";
import type {
  AgentAvailableCalendar,
  AgentCalendar,
  AgentCalendarAccount,
} from "../services/MinervaCalendarAgentClient";

/** A calendar_accounts row as the services read it. */
export type GraphQlCalendarAccount = {
  id: string;
  provider: string;
  subject: string;
  email: string;
  userId: string | null;
  verifiedTime: string | null;
  verificationMethod: string | null;
};

/** One of the user's accounts, with its credential's state from the agent (unknown without it). */
export const toCalendarAccount = (
  row: GraphQlCalendarAccount,
  agent: AgentCalendarAccount | undefined,
  agentReached: boolean,
): CalendarAccount => ({
  id: row.id,
  provider: row.provider as CalendarProvider,
  email: row.email,
  status: !agentReached
    ? CalendarAccountStatus.Unknown
    : agent
      ? (agent.status as CalendarAccountStatus)
      : CalendarAccountStatus.NotConnected,
  ...(agent?.error ? { error: agent.error } : {}),
  verification: row.verificationMethod as CalendarAccountVerification,
  verifiedTime: moment.utc(row.verifiedTime),
});

export const toCalendar = (
  agent: AgentCalendar,
  accountId: string,
  color?: string,
): Calendar => ({
  calendarId: agent.calendarId,
  accountId,
  source: agent.source,
  enabled: agent.enabled,
  includedInBusy: agent.includedInBusy,
  synced: agent.synced,
  syncing: agent.syncing,
  ...(agent.lastSyncedAt
    ? { lastSyncedTime: moment.utc(agent.lastSyncedAt) }
    : {}),
  ...(color ? { color } : {}),
});

export const toAvailableCalendar = (
  agent: AgentAvailableCalendar,
): AvailableCalendar => ({
  calendarId: agent.id,
  name: agent.summary,
  synced: agent.alreadySynced,
});
