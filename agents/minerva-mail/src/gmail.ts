import "source-map-support/register";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { validateEnvironment } from "./config/configuration";
import { GmailCommandModule } from "./gmail/GmailCommandModule";
import { GmailPoll } from "./gmail/GmailPoll";
import { GmailReconcile } from "./gmail/GmailReconcile";

const USAGE = `Usage:
  gmail reconcile <mailbox email>
  gmail poll [mailbox email]

  reconcile  Brings a linked mailbox into step with Gmail: labels get their
             Gmail IDs (new ones added); every message's labels and flags
             are compared with Gmail's, a label at a time, and the changes
             published to mail.messages; mail Minerva lacks (since the
             Takeout export) is fetched and published whole; messages gone
             from Gmail are deleted. Records Gmail's historyId and totals
             at the end. Read-only on Gmail; prints counts as JSON, never
             content. Safe to run again.

  poll       Polls history once, as the running agent does every
             MAIL_GMAIL_POLL_SECONDS: every linked mailbox, or the one
             named. Changes since the recorded historyId are published;
             a mailbox without one, or whose history Gmail no longer has,
             is reconciled. Prints counts as JSON.
`;

const main = async (args: string[]): Promise<number> => {
  const [command, email] = args;
  if ((command === "reconcile" && email) || command === "poll") {
    const config = validateEnvironment();
    if (!config.gmail) {
      throw new Error(
        `${command} needs Gmail's client: MAIL_GOOGLE_OAUTH_CLIENT_ID and _SECRET_FILE (see dev.env.example)`,
      );
    }
    const app = await NestFactory.createApplicationContext(GmailCommandModule, {
      logger: ["log", "warn", "error"],
    });
    try {
      if (command === "poll") {
        const poll = app.get(GmailPoll);
        const address = email?.trim().toLowerCase();
        const reports = address
          ? [await poll.pollOne(address)]
          : await poll.pollAll();
        process.stdout.write(`${JSON.stringify(reports, null, 1)}\n`);
        return 0;
      }
      const report = await app.get(GmailReconcile).run(email, {
        onProgress: (stage, done, of) =>
          process.stderr.write(
            `${stage}: ${done}${of === undefined ? "" : ` of ${of}`}\n`,
          ),
      });
      process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
    } finally {
      await app.close();
    }
    return 0;
  }
  process.stderr.write(USAGE);
  return 2;
};

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    new Logger("Gmail").error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  },
);
