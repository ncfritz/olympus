import moment from "moment";
import type { OverrideBlock as DomainOverrideBlock } from "../../domain/availability";
import type { OverrideBlock } from "../../model/overrideBlocks";

/** A stored override block as the management API returns it. */
export const toDomainObject = (block: DomainOverrideBlock): OverrideBlock => ({
  id: block.id,
  startTime: moment.utc(block.startTime),
  endTime: moment.utc(block.endTime),
  status: block.status,
  label: block.label ?? undefined,
});
