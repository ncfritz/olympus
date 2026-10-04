import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  accountOf,
  type MeetingRow,
  toMeetingFields,
} from "../converters/CalendarEventConverter";

/** What became of one calendar event. */
export type CalendarEventOutcome =
  | { result: "written" }
  | { result: "unowned" }
  | { result: "invalid"; problems: string[] };

/** Every column an event sets, so a repeated message rewrites the same row. */
const EVENT_COLUMNS = [
  "subject",
  "sensitivity",
  "importance",
  "occurrence_type",
  "type",
  "reminder",
  "response",
  "start_time",
  "end_time",
  "duration",
  "all_day",
  "status",
  "location",
  "cancelled",
  "organizer_email",
  "deleted",
  "uid",
  "recurrence_id",
  "source",
  "user_id",
  "account_id",
].join("\n");

/**
 * Writes the calendar sync agent's events into Minerva (ADR 0028). The
 * account a message names decides its owner; an account no user owns is
 * not written. `upsert`, `backfill` and `delete` all write the event's
 * snapshot by its ID (a delete's says `deleted`), overwriting what the
 * row held, as ADR 0013 has it.
 */
@Injectable()
export class CalendarEventService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * @throws whatever the GraphQL client throws: the caller decides whether
   *   Hasura's answer makes the message worth retrying
   */
  async consume(message: unknown): Promise<CalendarEventOutcome> {
    const account = accountOf(message);
    if (!account) {
      // Absent when the agent has no subject for the account, or the
      // calendar is no longer synced: no one in Olympus owns the event.
      return { result: "unowned" };
    }
    // Check the message before asking who owns it: an invalid one is
    // invalid whoever does.
    const converted = toMeetingFields(message);
    if ("problems" in converted) {
      return { result: "invalid", problems: converted.problems };
    }
    const owner = await this.ownerOf(account.provider, account.subject);
    if (!owner) return { result: "unowned" };

    const meeting: MeetingRow = {
      ...converted.fields,
      user_id: owner.userId,
      account_id: owner.accountId,
    };
    const mutation = gql`
      mutation WriteCalendarEvent($meeting: minerva_meetings_insert_input!) {
        insert_minerva_meetings_one(
          object: $meeting
          on_conflict: {
            constraint: meetings_pkey
            update_columns: [${EVENT_COLUMNS}]
          }
        ) {
          id
        }
      }
    `;
    await this.graphQLClient.request(mutation, { meeting });
    return { result: "written" };
  }

  /** The user and ID of the account, when a user owns it. */
  private async ownerOf(
    provider: string,
    subject: string,
  ): Promise<{ userId: string; accountId: string } | undefined> {
    const query = gql`
      query DescribeCalendarEventOwner($provider: String!, $subject: String!) {
        minerva_calendar_accounts(
          where: {
            provider: { _eq: $provider }
            subject: { _eq: $subject }
            userId: { _is_null: false }
          }
          limit: 1
        ) {
          id
          userId
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_calendar_accounts: { id: string; userId: string }[];
    }>(query, { provider, subject });
    const account = response.minerva_calendar_accounts[0];
    return account
      ? { userId: account.userId, accountId: account.id }
      : undefined;
  }
}
