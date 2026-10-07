import type { MailCluster } from "@ncfritz/olympus-sdk/minerva";
import mailApi from "../../../../api/mailApi";
import {
  APPLY_BATCH,
  chunks,
  clusterChanges,
  MEMBER_PAGE,
} from "../../../../utils/mailClusters";

/**
 * Applies a cluster's suggestion to Gmail: its label created and its
 * messages, page by page, changed in batches. The number of messages
 * changed.
 */
export const applyCluster = async (c: MailCluster): Promise<number> => {
  if (!c.proposedName) return 0;
  const gmailIds: string[] = [];
  for (let offset = 0; ; offset += MEMBER_PAGE) {
    const page = (await mailApi.listClusterMembers(c.id, offset, MEMBER_PAGE))
      .data;
    gmailIds.push(...page.gmailIds);
    if (page.gmailIds.length < MEMBER_PAGE || gmailIds.length >= page.count) {
      break;
    }
  }
  let messages = 0;
  for (const changes of chunks(clusterChanges(c, gmailIds), APPLY_BATCH)) {
    messages += (
      await mailApi.applyChanges(c.accountId, changes, [c.proposedName])
    ).data.batch.messages;
  }
  return messages;
};
