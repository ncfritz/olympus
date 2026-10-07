import {
  acceptMailPaymentMatches,
  createMailFilter,
  type CreateMailFilterRequest,
  deleteMailFilter,
  dismissMailFilterProposal,
  listMailFilterProposals,
  listMailFilters,
  dismissMailPaymentMatches,
  listMailOpenBills,
  listMailPaymentMatches,
  type MailPaymentPair,
  listMailStarMismatches,
  type MailStarFix,
  describeMailCluster,
  getMailClusterMap,
  listMailClusterMembers,
  listMailClusterSuggestions,
  approveMailMessages,
  type ApproveMailMessagesRequest,
  getMailMessageContent,
  listMailInbox,
  type MailInboxStatus,
  skipMailMessages,
  updateMailMessageFlags,
  type UpdateMailMessageFlagsRequest,
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

/** What a page of the inbox is ordered by (`sortBy`). */
export type MailInboxSort = "receivedTime" | "confidence" | "from" | "subject";

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

  /** A page of the inbox with its suggestions, and the strip's counts. */
  async listInbox(query: {
    status?: MailInboxStatus;
    accountId?: string;
    search?: string;
    from?: string;
    subject?: string;
    minConfidence?: number;
    approvedSince?: string;
    sortBy?: MailInboxSort;
    sort?: "asc" | "desc";
    pageSize: number;
    startPage: number;
  }) {
    return await listMailInbox({ query });
  }

  /** Approves messages' labels, writing them (and archive, read) to Gmail. */
  async approveMessages(accountId: string, body: ApproveMailMessagesRequest) {
    return await approveMailMessages({ path: { accountId }, body });
  }

  /** Leaves messages' suggestions for now; Gmail unchanged. */
  async skipMessages(accountId: string, gmailIds: string[]) {
    return await skipMailMessages({ path: { accountId }, body: { gmailIds } });
  }

  /** Archives messages or marks them read, deciding nothing. */
  async updateFlags(accountId: string, body: UpdateMailMessageFlagsRequest) {
    return await updateMailMessageFlags({ path: { accountId }, body });
  }

  /** A message read live from Gmail, to show once. */
  async getMessageContent(accountId: string, gmailId: string) {
    return await getMailMessageContent({ path: { accountId, gmailId } });
  }

  /** The newest clustering of one mailbox, or of the last clustered. */
  async getClusterMap(accountId?: string) {
    return await getMailClusterMap({
      query: accountId ? { accountId } : {},
    });
  }

  /** A cluster, and its newest messages' metadata. */
  async describeCluster(clusterId: string) {
    return await describeMailCluster({ path: { clusterId } });
  }

  /** A page of a cluster's messages' Gmail IDs, and how many it has. */
  async listClusterMembers(clusterId: string, offset = 0, limit = 5000) {
    return await listMailClusterMembers({
      path: { clusterId },
      query: { offset, limit },
    });
  }

  /** The clusters that suggest something; with `label`, its splits. */
  async listClusterSuggestions(label?: string) {
    return await listMailClusterSuggestions({
      query: label ? { label } : {},
    });
  }

  /** Senders worth a Gmail filter. */
  async listFilterProposals(accountId?: string) {
    return await listMailFilterProposals({
      query: accountId ? { accountId } : {},
    });
  }

  /** The Gmail filters made from proposals. */
  async listFilters(accountId?: string) {
    return await listMailFilters({ query: accountId ? { accountId } : {} });
  }

  /** Makes a Gmail filter: the sender's mail gets the label. */
  async createFilter(accountId: string, body: CreateMailFilterRequest) {
    return await createMailFilter({ path: { accountId }, body });
  }

  /** Declines a filter proposal; Gmail unchanged. */
  async dismissFilterProposal(
    accountId: string,
    fromAddress: string,
    label: string,
  ) {
    return await dismissMailFilterProposal({
      path: { accountId },
      body: { fromAddress, label },
    });
  }

  /** Deletes a Gmail filter made from a proposal. */
  async deleteFilter(filterId: string) {
    return await deleteMailFilter({ path: { filterId } });
  }

  /** Payment confirmations and the open bills they pay. */
  async listPaymentMatches(query: {
    accountId?: string;
    inInbox?: boolean;
    offset?: number;
    limit?: number;
  }) {
    return await listMailPaymentMatches({ query });
  }

  /** Messages in an open state, oldest first, and their ages. */
  async listOpenBills(query: {
    accountId?: string;
    offset?: number;
    limit?: number;
  }) {
    return await listMailOpenBills({ query });
  }

  /** Approves matches: each bill moved along its transition, one batch. */
  async acceptPaymentMatches(accountId: string, pairs: MailPaymentPair[]) {
    return await acceptMailPaymentMatches({
      path: { accountId },
      body: { pairs },
    });
  }

  /** Records pairs as not a bill and its payment; Gmail unchanged. */
  async dismissPaymentMatches(accountId: string, pairs: MailPaymentPair[]) {
    return await dismissMailPaymentMatches({
      path: { accountId },
      body: { pairs },
    });
  }

  /** Messages whose state and star disagree, with their fixes. */
  async listStarMismatches(query: {
    fix?: MailStarFix;
    offset?: number;
    limit?: number;
  }) {
    return await listMailStarMismatches({ query });
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
