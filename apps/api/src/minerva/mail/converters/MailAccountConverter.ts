import {
  MailAccount,
  MailAccountVerification,
  MailStarIcon,
} from "@ncfritz/olympus-model";
import moment from "moment";

/** A `minerva.mail_accounts` row as Hasura returns it (custom column names). */
export type GraphQlMailAccount = {
  id: string;
  userId: string;
  email: string;
  verificationMethod: string;
  verifiedTime: string;
  linkedTime?: string | null;
  linkScope?: string | null;
  syncedTime?: string | null;
  gmailMessagesTotal?: number | null;
  gmailThreadsTotal?: number | null;
  attentionStar?: string | null;
  doneStar?: string | null;
};

export const toDomainObject = (input: GraphQlMailAccount): MailAccount => ({
  id: input.id,
  email: input.email,
  verification: input.verificationMethod as MailAccountVerification,
  verifiedTime: moment(input.verifiedTime),
  ...(input.linkedTime ? { linkedTime: moment(input.linkedTime) } : {}),
  ...(input.linkScope ? { linkScope: input.linkScope } : {}),
  ...(input.syncedTime ? { syncedTime: moment(input.syncedTime) } : {}),
  ...(typeof input.gmailMessagesTotal === "number"
    ? { gmailMessagesTotal: input.gmailMessagesTotal }
    : {}),
  ...(typeof input.gmailThreadsTotal === "number"
    ? { gmailThreadsTotal: input.gmailThreadsTotal }
    : {}),
  ...(input.attentionStar
    ? { attentionStar: input.attentionStar as MailStarIcon }
    : {}),
  ...(input.doneStar ? { doneStar: input.doneStar as MailStarIcon } : {}),
});
