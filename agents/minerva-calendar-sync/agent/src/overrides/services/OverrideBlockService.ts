import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AvailabilityStatus } from "../../domain/availability";
import type {
  BaseOverrideBlock,
  ListOverrideBlocksQuery,
  OverrideBlock,
} from "../../model/overrideBlocks";
import {
  OVERRIDE_BLOCK_STORE,
  type OverrideBlockStore,
} from "../../store/overrideBlockStore";
import { toDomainObject } from "../converters/OverrideBlockConverter";

/**
 * The internal "Overrides" calendar — independent blocks of time that
 * override the computed availability status for everything they cover,
 * regardless of what's synced underneath. See AvailabilityService for how
 * these combine with synced meetings and per-meeting overrides.
 */
@Injectable()
export class OverrideBlockService {
  constructor(
    @Inject(OVERRIDE_BLOCK_STORE) private readonly store: OverrideBlockStore,
  ) {}

  async create(block: BaseOverrideBlock): Promise<OverrideBlock> {
    if (
      !(new Date(block.startTime).getTime() < new Date(block.endTime).getTime())
    ) {
      throw new BadRequestException("startTime must be before endTime");
    }
    return toDomainObject(
      await this.store.create({ ...block, label: block.label ?? null }),
    );
  }

  async list(query: ListOverrideBlocksQuery): Promise<OverrideBlock[]> {
    const blocks = await this.store.listOverlapping(query.start, query.end);
    return blocks.map(toDomainObject);
  }

  async update(
    overrideBlockId: string,
    status: AvailabilityStatus,
  ): Promise<OverrideBlock> {
    const updated = await this.store.updateStatus(overrideBlockId, status);
    if (!updated) {
      throw new NotFoundException(
        `Override block with id ${overrideBlockId} not found`,
      );
    }
    return toDomainObject(updated);
  }

  /** Deleting a block that doesn't exist succeeds (it's gone either way). */
  delete(overrideBlockId: string): Promise<void> {
    return this.store.delete(overrideBlockId);
  }
}
