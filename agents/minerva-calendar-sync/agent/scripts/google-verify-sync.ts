/**
 * Manual verification for Phase 2: lists calendars for an authorized
 * account, then fetches and normalizes a handful of events from one
 * calendar so the Google -> canonical mapping can be eyeballed against a
 * real account. Does not touch the database.
 *
 * Usage:
 *   pnpm google:verify -- --label personal-gmail [--calendar-id primary] [--limit 10]
 */
import "dotenv/config";
import { calendar_v3 } from "googleapis";
import { GoogleCalendarProvider } from "../src/providers/google/google-calendar-provider";
import { createAuthorizedGoogleClient } from "../src/providers/google/google-credential-store";

async function main(): Promise<void> {
  const label = requireArg("--label");
  const calendarId = argOrDefault("--calendar-id", "primary");
  const limit = Number(argOrDefault("--limit", "10"));

  const client = createAuthorizedGoogleClient(label);
  const provider = new GoogleCalendarProvider(client);

  console.log(`Calendars visible to "${label}":`);
  for (const cal of await provider.listCalendars()) {
    console.log(`  ${cal.id}  (${cal.summary})`);
  }

  console.log(`\nFirst ${limit} raw events on "${calendarId}", normalized:\n`);

  let printed = 0;
  outer: for await (const batch of provider.fullSync(calendarId)) {
    for (const raw of batch.events as calendar_v3.Schema$Event[]) {
      if (printed >= limit) break outer;
      printed += 1;

      console.log(`--- raw (${raw.id}) ---`);
      console.log(
        JSON.stringify(
          {
            summary: raw.summary,
            status: raw.status,
            visibility: raw.visibility,
            transparency: raw.transparency,
            start: raw.start,
            end: raw.end,
            recurrence: raw.recurrence,
            recurringEventId: raw.recurringEventId,
            attendees: raw.attendees,
            organizer: raw.organizer,
          },
          null,
          2,
        ),
      );

      try {
        console.log("--- normalized ---");
        console.log(JSON.stringify(provider.normalizeEvent(raw, { source: label }), null, 2));
      } catch (error) {
        console.log("--- normalize FAILED ---");
        console.log(error instanceof Error ? error.message : error);
      }
      console.log();
    }
  }

  if (printed === 0) {
    console.log("(no events found on this calendar)");
  }
}

function requireArg(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing required arg ${flag}`);
  return value;
}

function argOrDefault(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
