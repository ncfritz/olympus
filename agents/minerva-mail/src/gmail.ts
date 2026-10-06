import "source-map-support/register";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { validateEnvironment } from "./config/configuration";
import { GmailReconcile } from "./gmail/GmailReconcile";
import { GmailSyncModule } from "./gmail/GmailSyncModule";

const USAGE = `Usage:
  gmail reconcile <mailbox email>

  reconcile  Brings a linked mailbox into step with Gmail: labels get their
             Gmail IDs (new ones added); every message's labels and flags
             are compared with Gmail's, a label at a time, and the changes
             published to mail.messages; mail Minerva lacks (since the
             Takeout export) is fetched and published whole; messages gone
             from Gmail are deleted. Records Gmail's historyId and totals
             at the end. Read-only on Gmail; prints counts as JSON, never
             content. Safe to run again.
`;

const main = async (args: string[]): Promise<number> => {
  const [command, email] = args;
  if (command === "reconcile" && email) {
    const config = validateEnvironment();
    if (!config.gmail) {
      throw new Error(
        "reconcile needs Gmail's client: MAIL_GOOGLE_OAUTH_CLIENT_ID and _SECRET_FILE (see dev.env.example)",
      );
    }
    const app = await NestFactory.createApplicationContext(GmailSyncModule, {
      logger: ["log", "warn", "error"],
    });
    try {
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
