import {
  client,
  getMailAudit,
  getMailStatistics,
  listMailAuditChanges,
  type MailAuditAction,
  type MailStatisticsRange,
  type MailStatisticsScope,
  runMailAudit,
  type SortDirection,
} from "@ncfritz/olympus-sdk/minerva";

/** Mail (ADR 0030): the caller's own mail, through the API. */
/** What a page of proposed changes is ordered by (`sortBy`). */
export type MailAuditChangeSort = "confidence" | "receivedTime";

class MailApi {
  constructor() {
    client.setConfig({
      baseURL: "/api/v1",
      throwOnError: true,
    });
  }

  async getStatistics(range: MailStatisticsRange, scope: MailStatisticsScope) {
    return await getMailStatistics({ query: { range, scope } });
  }

  async runAudit() {
    return await runMailAudit();
  }

  async getAudit() {
    return await getMailAudit();
  }

  async listAuditChanges(query: {
    label?: string;
    action?: MailAuditAction;
    minConfidence?: number;
    sortBy?: MailAuditChangeSort;
    sort?: SortDirection;
    pageSize: number;
    startPage: number;
  }) {
    return await listMailAuditChanges({ query });
  }
}

const mailApi = new MailApi();

export default mailApi;
