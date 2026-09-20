import moment from "moment";
import type { AvailabilitySlot as DomainAvailabilitySlot } from "../../domain/availability";
import { AvailabilitySlot } from "../../model/availability";

/** A computed slot as the management API returns it. */
export const toDomainObject = (
  slot: DomainAvailabilitySlot,
): AvailabilitySlot => ({
  startTime: moment.utc(slot.startTime),
  endTime: moment.utc(slot.endTime),
  status: slot.status,
});
