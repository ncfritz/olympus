import { Tag } from "@ncfritz/olympus-model";
import moment from "moment";

/** A `minerva.tags` row as Hasura returns it (custom column names). */
export type GraphQlTag = {
  id: string;
  name: string;
  color: string | null;
  createdTime: string;
  lastUpdatedTime: string | null;
};

export const toDomainObject = (input: GraphQlTag): Tag => ({
  id: input.id,
  name: input.name,
  color: input.color ?? undefined,
  createdTime: moment(input.createdTime),
  lastUpdatedTime: input.lastUpdatedTime
    ? moment(input.lastUpdatedTime)
    : undefined,
});
