import type { Href } from "expo-router";

import type { Cause, Item } from "./schedule";

/** Where an item opens: its meeting, or the override to edit. */
export const hrefOf = (item: Pick<Item, "kind" | "id">): Href =>
  item.kind === "meeting"
    ? { pathname: "/meeting/[meetingId]", params: { meetingId: item.id } }
    : { pathname: "/override/[blockId]", params: { blockId: item.id } };

/** What Change on Now opens: whatever is setting the status, else a new override. */
export const changeHref = (cause: Cause | undefined): Href => {
  if (cause?.kind === "meeting") {
    return hrefOf({ kind: "meeting", id: cause.meeting.meetingId });
  }
  if (cause?.kind === "block") {
    return hrefOf({ kind: "block", id: cause.block.id });
  }
  return "/override/new";
};
