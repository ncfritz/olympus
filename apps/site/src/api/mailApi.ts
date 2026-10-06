import {
  client,
  connectMailAccount,
  listMailAccounts,
  createMailLabelFamily,
  type CreateMailLabelFamilyRequest,
  deleteMailLabelFamily,
  exportMailAuditChanges,
  getMailAudit,
  getMailStatistics,
  listMailAuditChanges,
  listMailLabelFamilies,
  listMailLabels,
  type MailAuditAction,
  type MailAuditRule,
  type MailStatisticsRange,
  type MailStatisticsScope,
  runMailAudit,
  updateMailLabel,
  type UpdateMailLabelRequest,
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
    rule?: MailAuditRule;
    minConfidence?: number;
    sortBy?: MailAuditChangeSort;
    sort?: SortDirection;
    pageSize: number;
    startPage: number;
  }) {
    return await listMailAuditChanges({ query });
  }

  async listAccounts() {
    return await listMailAccounts();
  }

  async connectAccount(accountId: string, returnTo: string) {
    return await connectMailAccount({
      path: { accountId },
      body: { returnTo },
    });
  }

  async listLabels() {
    return await listMailLabels();
  }

  async updateLabel(labelId: string, body: UpdateMailLabelRequest) {
    return await updateMailLabel({ path: { labelId }, body });
  }

  async listFamilies() {
    return await listMailLabelFamilies();
  }

  async createFamily(body: CreateMailLabelFamilyRequest) {
    return await createMailLabelFamily({ body });
  }

  async deleteFamily(familyId: string) {
    return await deleteMailLabelFamily({ path: { familyId } });
  }

  /** The changes as CSV, and the file name the API gives it. */
  async exportAuditChanges(query: {
    label?: string;
    action?: MailAuditAction;
    rule?: MailAuditRule;
    minConfidence?: number;
  }) {
    return await exportMailAuditChanges({ query });
  }
}

const mailApi = new MailApi();

export default mailApi;
