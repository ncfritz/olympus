import "source-map-support/register";

import { TakeoutScan } from "./takeout/TakeoutScan";

const USAGE = `Usage: takeout scan <mbox> [--offset <bytes>] [--limit <messages>] [--max-seconds <s>]

  scan   Reads and parses a Google Takeout mbox as the import will, and
         prints what it found as JSON: counts only, never message content.
         Writes nothing, publishes nothing. --offset resumes at a byte
         offset a previous run printed as nextOffset.
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

const main = async (args: string[]): Promise<number> => {
  const [command, path] = args;
  if (command !== "scan" || !path) {
    process.stderr.write(USAGE);
    return 2;
  }
  const report = await new TakeoutScan().run(path, {
    offset: number(args, "--offset"),
    limit: number(args, "--limit"),
    maxSeconds: number(args, "--max-seconds"),
    onProgress: (messages, bytes, seconds) =>
      process.stderr.write(
        `${messages} messages, ${(bytes / 1e9).toFixed(2)} GB, ${seconds.toFixed(0)} s\n`,
      ),
  });
  process.stdout.write(`${JSON.stringify(report, null, 1)}\n`);
  return 0;
};

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  },
);
