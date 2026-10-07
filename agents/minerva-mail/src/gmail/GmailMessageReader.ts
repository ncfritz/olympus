import { Injectable, NotFoundException } from "@nestjs/common";
import PostalMime, { type Address, type Email } from "postal-mime";
import type { GmailMessageAddress, GmailMessageContent } from "../model/gmail";
import { htmlToText } from "../sources/bodyText";
import { MimeParseError } from "../sources/MimeParseError";
import { GmailClient, type GmailMailbox, gmailStatusOf } from "./GmailClient";

/** The most of a body sent back, in characters, each of text and HTML. */
export const MAX_BODY_CHARS = 1_000_000;

const GMAIL_ID = /^[0-9a-f]{1,16}$/;

const addresses = (
  value: Address[] | Address | undefined,
): GmailMessageAddress[] =>
  (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((a) => (a.group ? a.group : [a]))
    .filter((m) => m.address)
    .map((m) => ({
      address: (m.address ?? "").trim(),
      ...(m.name ? { name: m.name.trim() } : {}),
    }));

const cut = (value: string): { value: string; cut: boolean } =>
  value.length > MAX_BODY_CHARS
    ? { value: value.slice(0, MAX_BODY_CHARS), cut: true }
    : { value, cut: false };

/**
 * Reads one message live from Gmail to be shown in the site (docs/plans/
 * email-management phase 5; ADR 0030): headers, body and what is attached,
 * parsed in memory and returned to the API, which checked the caller owns
 * the mailbox. Nothing of it is stored, published or logged.
 */
@Injectable()
export class GmailMessageReader {
  constructor(private readonly gmail: GmailClient) {}

  /**
   * @throws NotFoundException Gmail has no such message
   * @throws ServiceUnavailableException the mailbox is not linked
   */
  async read(
    email: string,
    gmailId: string,
    open: (email: string) => GmailMailbox = (e) => this.gmail.mailbox(e),
  ): Promise<GmailMessageContent> {
    if (!GMAIL_ID.test(gmailId)) {
      throw new NotFoundException(`No message ${gmailId}`);
    }
    let raw;
    try {
      raw = await open(email).raw(gmailId);
    } catch (error) {
      if (gmailStatusOf(error) === 404) {
        throw new NotFoundException(`Gmail has no message ${gmailId}`);
      }
      throw error;
    }
    let parsed: Email;
    try {
      parsed = await PostalMime.parse(Buffer.from(raw.raw, "base64url"), {
        attachmentEncoding: "arraybuffer",
      });
    } catch (e) {
      throw new MimeParseError(e instanceof Error ? e.name : undefined);
    }
    const text = cut(
      parsed.text?.trim()
        ? parsed.text.trim()
        : parsed.html
          ? htmlToText(parsed.html)
          : "",
    );
    const html = parsed.html ? cut(parsed.html) : undefined;
    const sent = parsed.date ? new Date(parsed.date) : undefined;
    const from = addresses(parsed.from)[0];
    return {
      gmailId: raw.id,
      threadId: raw.threadId,
      labelIds: raw.labelIds ?? [],
      ...(parsed.subject !== undefined
        ? { subject: parsed.subject.trim() }
        : {}),
      ...(from ? { from } : {}),
      replyTo: addresses(parsed.replyTo),
      to: addresses(parsed.to),
      cc: addresses(parsed.cc),
      ...(sent && !Number.isNaN(sent.getTime())
        ? { sentTime: sent.toISOString() }
        : {}),
      receivedTime: new Date(Number(raw.internalDate)).toISOString(),
      text: text.value,
      ...(html ? { html: html.value } : {}),
      truncated: text.cut || Boolean(html?.cut),
      attachments: parsed.attachments.map((a) => ({
        ...(a.filename ? { filename: a.filename } : {}),
        mimeType: a.mimeType.toLowerCase(),
        sizeBytes:
          typeof a.content === "string"
            ? Buffer.byteLength(a.content)
            : a.content.byteLength,
        inline: a.disposition === "inline" || a.related === true,
      })),
    };
  }
}
