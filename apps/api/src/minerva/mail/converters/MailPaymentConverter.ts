import { MailPaymentMatch } from "@ncfritz/olympus-model";
import moment from "moment";

/** The fields of a `minerva.mail_payment_matches` row the API reads. */
export const PAYMENT_MATCH_FIELDS = `
  accountId
  confirmationGmailId
  confirmedTime
  billGmailId
  billReceivedTime
  fromLabel
  toLabel
  billStarred
  bill {
    subject
    fromAddress
  }
`;

/** A `minerva.mail_payment_matches` row as Hasura returns it. */
export type GraphQlPaymentMatch = {
  accountId: string;
  confirmationGmailId: string;
  confirmedTime: string;
  billGmailId: string;
  billReceivedTime: string;
  fromLabel: string;
  toLabel: string;
  billStarred: boolean;
  bill: { subject: string | null; fromAddress: string | null };
};

export const toPaymentMatch = (m: GraphQlPaymentMatch): MailPaymentMatch => ({
  accountId: m.accountId,
  confirmationGmailId: m.confirmationGmailId,
  confirmedTime: moment(m.confirmedTime),
  billGmailId: m.billGmailId,
  ...(m.bill.subject ? { billSubject: m.bill.subject } : {}),
  ...(m.bill.fromAddress ? { billFromAddress: m.bill.fromAddress } : {}),
  billReceivedTime: moment(m.billReceivedTime),
  fromLabel: m.fromLabel,
  toLabel: m.toLabel,
  billStarred: m.billStarred,
});
