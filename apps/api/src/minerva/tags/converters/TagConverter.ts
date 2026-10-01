import { Tag } from "@ncfritz/olympus-model";
import moment from "moment";

/** A `minerva.tags` row as Hasura returns it (custom column names). */
export type GraphQlTag = {
  id: string;
  name: string;
  color: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
  /** The goals the tag is on that are not deleted. */
  goalTags_aggregate: { aggregate: { count: number } };
};

export const toDomainObject = (input: GraphQlTag): Tag => ({
  id: input.id,
  name: input.name,
  color: input.color ?? undefined,
  goalCount: input.goalTags_aggregate.aggregate.count,
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
