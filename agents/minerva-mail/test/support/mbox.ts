import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/*
 * Synthetic Takeout mbox content for tests. Never real mail
 * (docs/conventions/python.md and docs/plans/email-management).
 */

export type FixtureMessage = {
  id: string;
  date?: string;
  thread?: string | null;
  labels?: string | null;
  headers?: string[];
  body?: string;
};

export const message = ({
  id,
  date = "Fri Oct 02 03:46:59 +0000 2026",
  thread = "1877908200997168565",
  labels = "Archived,Category Updates,Accounts/Example",
  headers = [
    "From: Example Sender <sender@example.com>",
    "To: owner@example.net",
    "Subject: Hello",
    "Date: Fri, 2 Oct 2026 03:46:58 +0000",
    "Content-Type: text/plain; charset=utf-8",
  ],
  body = "Hello there.\n",
}: FixtureMessage): string =>
  [
    `From ${id}@xxx ${date}`,
    ...(thread === null ? [] : [`X-GM-THRID: ${thread}`]),
    ...(labels === null ? [] : [`X-Gmail-Labels: ${labels}`]),
    ...headers,
    "",
    body,
  ].join("\n");

/** Messages joined as Takeout writes them, with a blank line between. */
export const mbox = (...messages: string[]): string =>
  messages.map((m) => (m.endsWith("\n") ? m : `${m}\n`)).join("\n");

export const writeMbox = (content: string | Buffer): string => {
  const dir = mkdtempSync(join(tmpdir(), "mbox-"));
  const path = join(dir, "mail.mbox");
  writeFileSync(path, content);
  return path;
};
