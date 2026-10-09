import type { ReviewItem } from "@ncfritz/olympus-sdk/minerva";
import reviewsApi from "../../../api/reviewsApi";

/**
 * Applies a triage decision to a planned item, or takes its decision
 * back (`null`). An item already carried is uncarried first: its copy,
 * found among `loaded`, is deleted, which opens the item again (the API's
 * DeleteReviewItem). An item is carried by `carry`; one marked done or
 * dropped is opened first, as only an open or someday item is carried.
 */
export const applyTriage = async (
  item: ReviewItem,
  decision: "done" | "carry" | "later" | "drop" | null,
  loaded: ReviewItem[],
  carry: () => Promise<void>,
): Promise<void> => {
  let status = item.status;
  if (status === "carried") {
    const copy = loaded.find((i) => i.carriedFromId === item.id);
    if (!copy) {
      throw new Error(
        "Its copy is planned for a period not shown here; change it there",
      );
    }
    await reviewsApi.deleteItem(copy.id);
    status = "open";
  }
  if (decision === "carry") {
    if (status === "done" || status === "dropped") {
      await reviewsApi.updateItem(item.id, { status: "open" });
    }
    await carry();
    return;
  }
  const next =
    decision === "done"
      ? "done"
      : decision === "later"
        ? "someday"
        : decision === "drop"
          ? "dropped"
          : "open";
  if (next !== status) {
    await reviewsApi.updateItem(item.id, { status: next });
  }
};
