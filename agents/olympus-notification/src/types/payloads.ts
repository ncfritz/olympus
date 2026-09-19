import { Attachment } from "nodemailer/lib/mailer";

export interface WebSocketPayload {
  type: "plain" | "context";
  value: string | Record<never, never>;
}

export interface SynoChatPayload {
  text: string;
  file_url?: string;
  user_ids?: number[];
}

export interface SMTPPayload {
  subject: string;
  htmlPart: string;
  plaintextPart: string;
  attachments?: Attachment[];
}
