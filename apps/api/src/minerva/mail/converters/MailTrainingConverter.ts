import {
  MailLabelKind,
  MailTrainingAccount,
  MailTrainingExample,
  MailTrainingFamily,
} from "@ncfritz/olympus-model";
import moment from "moment";

/* The training rows as Hasura returns them (custom column names). */

export type GraphQlMailTrainingAccount = { id: string; email: string };

/** A label as far as the training target needs it. */
export type GraphQlTrainingLabel = {
  name: string;
  kind: MailLabelKind;
  family?: { name: string } | null;
  mergeTarget?: {
    name: string;
    kind: MailLabelKind;
    family?: { name: string } | null;
  } | null;
};

export type GraphQlMailTrainingMessage = {
  gmailId: string;
  threadId: string;
  receivedTime: string;
  fromAddress?: string | null;
  listId?: string | null;
  sent: boolean;
  messageLabels: { label: GraphQlTrainingLabel }[];
};

export type GraphQlMailTrainingFamily = {
  name: string;
  initialLabel: { name: string };
  states: { name: string }[];
};

/** What a label teaches: a topic, a family, or nothing. */
export type TrainingTarget = { topic: string } | { family: string } | undefined;

/**
 * A label's training target (ADR 0030, Label kinds): a topical label is a
 * topic; a state counts as its family; a retired label counts as what it
 * merges into, the target mapped the same way; a system label (and so a
 * star) is never a target.
 */
export const toTarget = (label: GraphQlTrainingLabel): TrainingTarget => {
  switch (label.kind) {
    case MailLabelKind.Topical:
      return { topic: label.name };
    case MailLabelKind.State:
      return label.family ? { family: label.family.name } : undefined;
    case MailLabelKind.Retired: {
      const into = label.mergeTarget;
      // A merge never chains (MailLabelService), so one step is enough.
      if (!into || into.kind === MailLabelKind.Retired) return undefined;
      return toTarget({ ...into, mergeTarget: null });
    }
    default:
      return undefined;
  }
};

const sortedUnique = (values: string[]) => [...new Set(values)].sort();

export const toTrainingAccount = (
  input: GraphQlMailTrainingAccount,
): MailTrainingAccount => ({ id: input.id, email: input.email });

export const toTrainingExample = (
  input: GraphQlMailTrainingMessage,
): MailTrainingExample => {
  const targets = input.messageLabels.map(({ label }) => toTarget(label));
  return {
    gmailId: input.gmailId,
    threadId: input.threadId,
    receivedTime: moment(input.receivedTime),
    fromAddress: input.fromAddress ?? undefined,
    listId: input.listId ?? undefined,
    sent: input.sent,
    topics: sortedUnique(
      targets.flatMap((t) => (t && "topic" in t ? [t.topic] : [])),
    ),
    families: sortedUnique(
      targets.flatMap((t) => (t && "family" in t ? [t.family] : [])),
    ),
  };
};

export const toTrainingFamily = (
  input: GraphQlMailTrainingFamily,
): MailTrainingFamily => ({
  name: input.name,
  initialLabel: input.initialLabel.name,
  states: input.states.map((s) => s.name).sort(),
});
