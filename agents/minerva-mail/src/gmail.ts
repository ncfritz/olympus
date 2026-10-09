import "source-map-support/register";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { validateEnvironment } from "./config/configuration";
import { GmailCommandModule } from "./gmail/GmailCommandModule";
import {
  EMBED_MISSING_LIMIT,
  GmailEmbedMissing,
} from "./gmail/GmailEmbedMissing";
import { GmailPoll } from "./gmail/GmailPoll";
import { GmailReconcile } from "./gmail/GmailReconcile";
import { GmailSuggestInbox } from "./gmail/GmailSuggestInbox";

const USAGE = `Usage:
  gmail reconcile <mailbox email>
  gmail poll [mailbox email]
  gmail suggest <mailbox email>
  gmail embed-missing [mailbox email] [--limit N]

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

  suggest    Scores what is in the mailbox's inbox now with the
             classifier's serving model and records each message's
             suggested labels, for mail that arrived before new mail was
             scored as it came (new mail is scored by poll and reconcile).
             Reads each message whole from Gmail; its text goes only to
             the classifier. Prints counts as JSON. Safe to run again.

  embed-missing
             The nightly backstop for embeddings: mail featurized while
             the embedding model was down has no vector. The classifier
             lists them (every linked mailbox, or the one named; the
             newest, at most --limit, default ${EMBED_MISSING_LIMIT}); each is read
             whole from Gmail again and its text sent only to the
             classifier to embed. Prints counts as JSON. Safe to run
             again; infra/airflow's minerva_mail_retrain runs it first.
`;

/** `--limit N` taken out of the arguments, the rest left in order. */
const takeLimit = (args: string[]): { rest: string[]; limit?: number } => {
  const at = args.indexOf("--limit");
  if (at === -1) return { rest: args };
  const limit = Number(args[at + 1]);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit takes a whole number of messages, at least 1");
  }
  return { rest: [...args.slice(0, at), ...args.slice(at + 2)], limit };
};

const main = async (argv: string[]): Promise<number> => {
  const { rest: args, limit } = takeLimit(argv);
  const [command, email] = args;
  if (
    ((command === "reconcile" || command === "suggest") && email) ||
    command === "poll" ||
    command === "embed-missing"
  ) {
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
      if (command === "embed-missing") {
        const reports = await app.get(GmailEmbedMissing).run(email, { limit });
        process.stdout.write(`${JSON.stringify(reports, null, 1)}\n`);
        // A run that could not embed is a failed nightly step.
        return reports.some((r) => r.failed > 0) ? 1 : 0;
      }
      if (command === "suggest") {
        const report = await app.get(GmailSuggestInbox).run(email, {
          onProgress: (done, of) => {
            if (done % 100 === 0 || done === of) {
              process.stderr.write(`scored: ${done} of ${of}\n`);
            }
          },
        });
        process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
        return 0;
      }
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
