import {
  MailLabel,
  MailLabelFamily,
  MailLabelKind,
} from "@ncfritz/olympus-model";

/** A `minerva.mail_labels` row as Hasura returns it, with its relations. */
export type GraphQlMailLabel = {
  id: string;
  accountId: string;
  name: string;
  type: string;
  kind: string;
  familyId: string | null;
  stateOpen: boolean | null;
  mergeTargetId: string | null;
  family: { name: string } | null;
  mergeTarget: { name: string } | null;
  messageLabels_aggregate?: { aggregate: { count: number } };
};

export const toLabel = (input: GraphQlMailLabel): MailLabel => ({
  id: input.id,
  accountId: input.accountId,
  name: input.name,
  kind: input.kind as MailLabelKind,
  messages: input.messageLabels_aggregate?.aggregate.count ?? 0,
  ...(input.familyId ? { familyId: input.familyId } : {}),
  ...(input.family ? { familyName: input.family.name } : {}),
  ...(input.stateOpen !== null ? { stateOpen: input.stateOpen } : {}),
  ...(input.mergeTargetId ? { mergeTargetId: input.mergeTargetId } : {}),
  ...(input.mergeTarget ? { mergeTargetName: input.mergeTarget.name } : {}),
});

/** A `minerva.mail_label_families` row with its states and transitions. */
export type GraphQlMailLabelFamily = {
  id: string;
  accountId: string;
  name: string;
  initialLabelId: string;
  states: { id: string; name: string; stateOpen: boolean }[];
  transitions: { fromLabelId: string; toLabelId: string }[];
};

export const toFamily = (input: GraphQlMailLabelFamily): MailLabelFamily => ({
  id: input.id,
  accountId: input.accountId,
  name: input.name,
  initialLabelId: input.initialLabelId,
  states: input.states.map((s) => ({
    labelId: s.id,
    name: s.name,
    open: s.stateOpen,
  })),
  transitions: input.transitions.map((t) => ({
    fromLabelId: t.fromLabelId,
    toLabelId: t.toLabelId,
  })),
});
