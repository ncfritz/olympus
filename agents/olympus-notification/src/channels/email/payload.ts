import type { Attachment } from "nodemailer/lib/mailer";

/** A rendered email. */
export interface SmtpPayload {
  subject: string;
  htmlPart: string;
  plaintextPart: string;
  attachments?: Attachment[];
}
