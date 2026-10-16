import type { Href } from "expo-router";

import type { ChangeTarget, Item } from "./schedule";

/** Where an item opens: its meeting, or the override to edit. */
export const hrefOf = (item: Pick<Item, "kind" | "id">): Href =>
  item.kind === "meeting"
    ? { pathname: "/meeting/[meetingId]", params: { meetingId: item.id } }
    : { pathname: "/override/[blockId]", params: { blockId: item.id } };

/** What Now's change button opens: the override, or the meeting's status. */
export const changeHref = (target: ChangeTarget): Href =>
  target.kind === "meeting"
    ? hrefOf({ kind: "meeting", id: target.meeting.meetingId })
    : hrefOf({ kind: "block", id: target.block.id });
