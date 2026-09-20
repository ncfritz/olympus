import { AvailabilityStatus, OverrideBlock } from "../domain/availability";

/** Blocks of time on the internal "Overrides" calendar, independent of any synced meeting. */
export interface OverrideBlockStore {
  create(block: Omit<OverrideBlock, "id">): Promise<OverrideBlock>;
  /** Null if no block with that id exists. */
  updateStatus(
    id: string,
    status: AvailabilityStatus,
  ): Promise<OverrideBlock | null>;
  listOverlapping(start: string, end: string): Promise<OverrideBlock[]>;
  delete(id: string): Promise<void>;
}

/** Nest DI token — inject with `@Inject(OVERRIDE_BLOCK_STORE)`. */
export const OVERRIDE_BLOCK_STORE = Symbol("OVERRIDE_BLOCK_STORE");
