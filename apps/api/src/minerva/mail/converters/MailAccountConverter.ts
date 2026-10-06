import { MailAccount, MailAccountVerification } from "@ncfritz/olympus-model";
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
};

export const toDomainObject = (input: GraphQlMailAccount): MailAccount => ({
  id: input.id,
  email: input.email,
  verification: input.verificationMethod as MailAccountVerification,
  verifiedTime: moment(input.verifiedTime),
  ...(input.linkedTime ? { linkedTime: moment(input.linkedTime) } : {}),
  ...(input.linkScope ? { linkScope: input.linkScope } : {}),
});
