import {
  applyMailChanges,
  client,
  describeMailChangeBatch,
  dismissMailProposals,
  listMailChangeBatches,
  mergeMailLabels,
  previewMailLabelMerge,
  type MailLabelChange,
  type MailProposalRef,
  undoMailChangeBatch,
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
  applyMatchingMailProposals,
  dismissMatchingMailProposals,
  type MailAuditAction,
  type MailProposalFilter,
  type MailProposalStatus,
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
    status?: MailProposalStatus;
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

  /** Writes label changes to one mailbox in Gmail, as a batch. */
  async applyChanges(
    accountId: string,
    changes: MailLabelChange[],
    newLabels?: string[],
  ) {
    return await applyMailChanges({
      path: { accountId },
      body: { changes, ...(newLabels?.length ? { newLabels } : {}) },
    });
  }

  /** What merging `from` into `into` would do; changes nothing. */
  async previewMerge(accountId: string, from: string, into: string) {
    return await previewMailLabelMerge({
      path: { accountId },
      query: { from, into },
    });
  }

  /** Merges `from` into `into` in Gmail, as a batch. */
  async mergeLabels(accountId: string, from: string, into: string) {
    return await mergeMailLabels({ path: { accountId }, body: { from, into } });
  }

  /** Applies every open proposal the filter matches, as batches. */
  async applyMatching(filter: MailProposalFilter) {
    return await applyMatchingMailProposals({ body: { filter } });
  }

  /** Marks every open proposal the filter matches processed. */
  async dismissMatching(filter: MailProposalFilter) {
    return await dismissMatchingMailProposals({ body: { filter } });
  }

  /** Marks proposals processed without changing Gmail. */
  async dismissProposals(accountId: string, proposals: MailProposalRef[]) {
    return await dismissMailProposals({
      path: { accountId },
      body: { proposals },
    });
  }

  async listChangeBatches(accountId: string, limit = 50) {
    return await listMailChangeBatches({
      path: { accountId },
      query: { limit },
    });
  }

  async describeChangeBatch(batchId: string, offset = 0, limit = 100) {
    return await describeMailChangeBatch({
      path: { batchId },
      query: { offset, limit },
    });
  }

  async undoChangeBatch(batchId: string) {
    return await undoMailChangeBatch({ path: { batchId } });
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
