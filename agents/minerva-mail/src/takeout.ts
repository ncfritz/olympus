import "source-map-support/register";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { validateEnvironment } from "./config/configuration";
import { TakeoutImport } from "./takeout/TakeoutImport";
import { TakeoutModule } from "./takeout/TakeoutModule";
import { TakeoutScan } from "./takeout/TakeoutScan";

const USAGE = `Usage:
  takeout scan <mbox> [--offset <bytes>] [--limit <messages>] [--max-seconds <s>]
  takeout import <mbox> --account <mailbox email> --owner <Olympus user email>
                 [--offset <bytes>] [--limit <messages>] [--max-seconds <s>]

  scan     Reads and parses a Google Takeout mbox as the import will, and
           prints what it found as JSON: counts only, never message
           content. Writes nothing, publishes nothing.
  import   Makes the mailbox the owner's mail account through the API, then
           publishes every message's metadata to mail.messages for the API
           to store. Skips chats, Trash and Spam. Reads the broker and the
           API from the environment (dev.env); makes no Gmail API calls.

  Both print nextOffset when they stop early; --offset resumes there.
`;

const number = (args: string[], flag: string): number | undefined => {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const value = Number(args[i + 1]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} takes a whole number, got "${args[i + 1]}"`);
  }
  return value;
};

const text = (args: string[], flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};

const progress = (label: string) => (n: number, m: number, s: number) =>
  process.stderr.write(`${n} messages, ${m} ${label}, ${s.toFixed(0)} s\n`);

const main = async (args: string[]): Promise<number> => {
  const [command, path] = args;
  const limits = {
    offset: number(args, "--offset"),
    limit: number(args, "--limit"),
    maxSeconds: number(args, "--max-seconds"),
  };
  if (command === "scan" && path) {
    const report = await new TakeoutScan().run(path, {
      ...limits,
      onProgress: (messages, bytes, seconds) =>
        progress("GB")(messages, Number((bytes / 1e9).toFixed(2)), seconds),
    });
    process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
    return 0;
  }
  const account = text(args, "--account");
  const owner = text(args, "--owner");
  if (command === "import" && path && account && owner) {
    // Fails fast, listing every invalid variable, before anything connects.
    validateEnvironment();
    const app = await NestFactory.createApplicationContext(TakeoutModule, {
      logger: ["log", "warn", "error"],
    });
    try {
      const report = await app.get(TakeoutImport).run(path, {
        ...limits,
        account,
        owner,
        onProgress: progress("published"),
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
    new Logger("Takeout").error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  },
);
