import { FilterDefinition, FilterType } from "@ncfritz/olympus-model";
import { BC_FILTER } from "./contentAuth";

/**
 * The black curtain for one request: whether it carries valid content auth,
 * and the filter restriction that follows. Set by ContentAuthGuard and
 * handed to controllers with @Curtain().
 */
export class ContentCurtain {
  constructor(readonly authenticated: boolean) {}

  /**
   * `filter` restricted to what the requester may see: unchanged with
   * content auth, otherwise combined with `curtain` (or the curtain alone).
   */
  restrict(
    filter: FilterDefinition | undefined,
    curtain: FilterDefinition = BC_FILTER,
  ): FilterDefinition | undefined {
    if (this.authenticated) return filter;
    return filter
      ? { type: FilterType.AND, name: "_", value: [curtain, filter] }
      : curtain;
  }
}
