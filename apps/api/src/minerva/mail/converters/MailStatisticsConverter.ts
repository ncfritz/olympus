import {
  MailLabelStatistics,
  MailLabelYear,
  MailSenderStatistics,
  MailSenderYear,
  MailStatisticsSummary,
} from "@ncfritz/olympus-model";
import moment from "moment";

/*
 * The mail statistics functions' rows as Hasura returns them (custom column
 * names). Counts are bigint, which Hasura may send as numbers or strings.
 */
type Count = number | string;

export type GraphQlMailStatisticsSummary = {
  messages: Count;
  labelsInUse: Count;
  senders: Count;
  unlabelled: Count;
  firstReceivedTime: string | null;
  lastReceivedTime: string | null;
};

export type GraphQlMailSenderStatistics = {
  address: string;
  name: string | null;
  messages: Count;
  lastReceivedTime: string;
};

export type GraphQlMailLabelStatistics = {
  name: string;
  messages: Count;
  senders: Count;
  lastReceivedTime: string;
};

export type GraphQlMailSenderYear = {
  address: string;
  year: number;
  messages: Count;
};

export type GraphQlMailLabelYear = {
  name: string;
  year: number;
  messages: Count;
};

export const toSummary = (
  input: GraphQlMailStatisticsSummary | undefined,
): MailStatisticsSummary => ({
  messages: Number(input?.messages ?? 0),
  labelsInUse: Number(input?.labelsInUse ?? 0),
  senders: Number(input?.senders ?? 0),
  unlabelled: Number(input?.unlabelled ?? 0),
  ...(input?.firstReceivedTime
    ? { firstReceivedTime: moment(input.firstReceivedTime) }
    : {}),
  ...(input?.lastReceivedTime
    ? { lastReceivedTime: moment(input.lastReceivedTime) }
    : {}),
});

export const toSenderStatistics = (
  input: GraphQlMailSenderStatistics,
): MailSenderStatistics => ({
  address: input.address,
  ...(input.name ? { name: input.name } : {}),
  messages: Number(input.messages),
  lastReceivedTime: moment(input.lastReceivedTime),
});

export const toLabelStatistics = (
  input: GraphQlMailLabelStatistics,
): MailLabelStatistics => ({
  name: input.name,
  messages: Number(input.messages),
  senders: Number(input.senders),
  lastReceivedTime: moment(input.lastReceivedTime),
});

export const toSenderYear = (input: GraphQlMailSenderYear): MailSenderYear => ({
  address: input.address,
  year: input.year,
  messages: Number(input.messages),
});

export const toLabelYear = (input: GraphQlMailLabelYear): MailLabelYear => ({
  name: input.name,
  year: input.year,
  messages: Number(input.messages),
});
