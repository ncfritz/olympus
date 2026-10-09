import {
  ReviewKind,
  ReviewPrompt,
  ReviewPromptSection,
  ReviewPromptStyle,
} from "@ncfritz/olympus-model";
import moment from "moment";

/** A `minerva.review_prompts` row as Hasura returns it (custom column names). */
export type GraphQlReviewPrompt = {
  id: string;
  kind: string;
  section: string;
  style: string;
  label: string;
  placeholder: string | null;
  position: number;
  archivedTime: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

export const toDomainObject = (input: GraphQlReviewPrompt): ReviewPrompt => ({
  id: input.id,
  kind: input.kind as ReviewKind,
  section: input.section as ReviewPromptSection,
  style: input.style as ReviewPromptStyle,
  label: input.label,
  placeholder: input.placeholder ?? undefined,
  position: input.position,
  archived: input.archivedTime !== null,
  archivedTime: input.archivedTime ? moment(input.archivedTime) : undefined,
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
