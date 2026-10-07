import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CreateMailFilterRequest,
  DismissMailFilterProposalRequest,
  MailFilter,
  MailFilterProposal,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import {
  minervaConfig,
  type MinervaConfigType,
} from "../../../config/configuration";
import { MinervaMailAgentClient } from "./MinervaMailAgentClient";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADDRESS = /^[^@\s]+@[^@\s]+$/;
/** The most proposals listed. */
export const MAX_FILTER_PROPOSALS = 200;

type GraphQlFilter = {
  id: string;
  accountId: string;
  fromAddress: string;
  skipInbox: boolean;
  createdTime: string;
  label: { name: string };
};

const FILTER_FIELDS = `
  id
  accountId
  fromAddress
  skipInbox
  createdTime
  label {
    name
  }
`;

const toFilter = (f: GraphQlFilter): MailFilter => ({
  id: f.id,
  accountId: f.accountId,
  fromAddress: f.fromAddress,
  label: f.label.name,
  skipInbox: f.skipInbox,
  createdTime: moment(f.createdTime),
});

const requireId = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new BadRequestException(`${name} must be an ID`);
  }
  return value;
};

/** A sender and label, checked: the address in lower case. */
const senderAndLabel = (
  request: { fromAddress?: unknown; label?: unknown } | undefined,
): { fromAddress: string; label: string } => {
  const from =
    typeof request?.fromAddress === "string"
      ? request.fromAddress.trim().toLowerCase()
      : "";
  const label = request?.label;
  if (!ADDRESS.test(from) || from.length > 320) {
    throw new BadRequestException("fromAddress must be an address");
  }
  if (typeof label !== "string" || label.length < 1 || label.length > 225) {
    throw new BadRequestException("label must be 1 to 225 characters");
  }
  return { fromAddress: from, label };
};

/**
 * Gmail filters (docs/plans/email-management phase 7 step 4): proposed
 * for a sender whose approved inbox mail nearly always carries one label
 * (`mail_filter_proposals`), made in Gmail by the mail agent on approval,
 * and kept here so their mail leaves review. Needs writes on
 * (MINERVA_MAIL_WRITES_ENABLED) and a mailbox linked for filters.
 */
@Injectable()
export class MailFilterService {
  private readonly logger = new Logger(MailFilterService.name);

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly agent: MinervaMailAgentClient,
    @Inject(minervaConfig.KEY) private readonly minerva: MinervaConfigType,
  ) {}

  /** The user's proposals, most approvals first. */
  async proposals(
    userId: string,
    accountId?: string,
  ): Promise<MailFilterProposal[]> {
    if (accountId !== undefined) requireId(accountId, "accountId");
    const query = gql`
      query ListMailFilterProposals(
        $where: minerva_mail_filter_proposals_bool_exp!
        $limit: Int!
      ) {
        minerva_mail_filter_proposals(
          where: $where
          order_by: [{ decisions: desc }, { fromAddress: asc }, { label: asc }]
          limit: $limit
        ) {
          accountId
          fromAddress
          label
          decisions
          kept
          lastDecidedTime
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_filter_proposals: (Omit<
        MailFilterProposal,
        "lastDecidedTime"
      > & { lastDecidedTime: string })[];
    }>(query, {
      where: {
        account: { userId: { _eq: userId } },
        ...(accountId ? { accountId: { _eq: accountId } } : {}),
      },
      limit: MAX_FILTER_PROPOSALS,
    });
    return response.minerva_mail_filter_proposals.map((p) => ({
      ...p,
      lastDecidedTime: moment(p.lastDecidedTime),
    }));
  }

  /** The user's filters, newest first. */
  async filters(userId: string, accountId?: string): Promise<MailFilter[]> {
    if (accountId !== undefined) requireId(accountId, "accountId");
    const query = gql`
      query ListMailFilters($where: minerva_mail_filters_bool_exp!) {
        minerva_mail_filters(where: $where, order_by: { createdTime: desc }) {
          ${FILTER_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_filters: GraphQlFilter[];
    }>(query, {
      where: {
        account: { userId: { _eq: userId } },
        ...(accountId ? { accountId: { _eq: accountId } } : {}),
      },
    });
    return response.minerva_mail_filters.map(toFilter);
  }

  /**
   * Makes the filter in Gmail and keeps it.
   *
   * @throws NotFoundException no such account of the user's, or label
   * @throws ConflictException the sender has a filter for the label, or
   *   the mailbox is not linked for filters
   * @throws ServiceUnavailableException writes are off
   */
  async create(
    userId: string,
    accountId: string,
    request: CreateMailFilterRequest,
  ): Promise<MailFilter> {
    requireId(accountId, "accountId");
    const { fromAddress, label } = senderAndLabel(request);
    if (typeof request.skipInbox !== "boolean") {
      throw new BadRequestException("skipInbox must be true or false");
    }
    if (!this.minerva.mailWritesEnabled) {
      throw new ServiceUnavailableException(
        "Writes to Gmail are turned off (MINERVA_MAIL_WRITES_ENABLED)",
      );
    }
    const target = await this.target(userId, accountId, fromAddress, label);
    if (target.filtered) {
      throw new ConflictException(
        `${fromAddress} has a filter for ${label} already`,
      );
    }
    const gmailFilterId = await this.agent.createFilter({
      email: target.email,
      from: fromAddress,
      label,
      skipInbox: request.skipInbox,
    });
    const mutation = gql`
      mutation CreateMailFilter($filter: minerva_mail_filters_insert_input!) {
        insert_minerva_mail_filters_one(object: $filter) {
          ${FILTER_FIELDS}
        }
      }
    `;
    try {
      const response = await this.graphQLClient.request<{
        insert_minerva_mail_filters_one: GraphQlFilter;
      }>(mutation, {
        filter: {
          accountId,
          fromAddress,
          labelId: target.labelId,
          skipInbox: request.skipInbox,
          gmailFilterId,
          userId,
        },
      });
      return toFilter(response.insert_minerva_mail_filters_one);
    } catch (error) {
      // Not kept: the filter is taken back out of Gmail.
      await this.agent
        .deleteFilter(target.email, gmailFilterId)
        .catch((e: unknown) =>
          this.logger.warn(
            `Could not take back filter ${gmailFilterId}: ${e instanceof Error ? e.message : String(e)}`,
          ),
        );
      throw error;
    }
  }

  /**
   * Records a proposal as declined; it is not proposed again.
   *
   * @throws NotFoundException no such account of the user's, or label
   */
  async dismiss(
    userId: string,
    accountId: string,
    request: DismissMailFilterProposalRequest,
  ): Promise<void> {
    requireId(accountId, "accountId");
    const { fromAddress, label } = senderAndLabel(request);
    const target = await this.target(userId, accountId, fromAddress, label);
    const mutation = gql`
      mutation DismissMailFilterProposal(
        $row: minerva_mail_filter_dismissals_insert_input!
      ) {
        insert_minerva_mail_filter_dismissals_one(
          object: $row
          on_conflict: {
            constraint: mail_filter_dismissals_pkey
            update_columns: []
          }
        ) {
          accountId
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      row: { accountId, fromAddress, labelId: target.labelId },
    });
  }

  /**
   * Deletes the filter in Gmail and here; mail it labelled keeps its label.
   *
   * @throws NotFoundException no such filter of the user's
   */
  async delete(userId: string, filterId: string): Promise<void> {
    requireId(filterId, "filterId");
    if (!this.minerva.mailWritesEnabled) {
      throw new ServiceUnavailableException(
        "Writes to Gmail are turned off (MINERVA_MAIL_WRITES_ENABLED)",
      );
    }
    const query = gql`
      query DescribeMailFilter($filterId: uuid!, $userId: uuid!) {
        minerva_mail_filters(
          where: {
            id: { _eq: $filterId }
            account: { userId: { _eq: $userId } }
          }
        ) {
          id
          gmailFilterId
          account {
            email
          }
        }
      }
    `;
    const found = await this.graphQLClient.request<{
      minerva_mail_filters: {
        id: string;
        gmailFilterId: string;
        account: { email: string };
      }[];
    }>(query, { filterId, userId });
    const filter = found.minerva_mail_filters[0];
    if (!filter) throw new NotFoundException(`No filter ${filterId}`);
    await this.agent.deleteFilter(filter.account.email, filter.gmailFilterId);
    const mutation = gql`
      mutation DeleteMailFilter($filterId: uuid!) {
        delete_minerva_mail_filters_by_pk(id: $filterId) {
          id
        }
      }
    `;
    await this.graphQLClient.request(mutation, { filterId });
  }

  /** The account's address, the label's ID, and whether it has a filter. */
  private async target(
    userId: string,
    accountId: string,
    fromAddress: string,
    label: string,
  ): Promise<{ email: string; labelId: string; filtered: boolean }> {
    const query = gql`
      query DescribeMailFilterTarget(
        $accountId: uuid!
        $userId: uuid!
        $label: String!
        $fromAddress: String!
      ) {
        minerva_mail_accounts(
          where: { id: { _eq: $accountId }, userId: { _eq: $userId } }
        ) {
          email
          labels(
            where: {
              name: { _eq: $label }
              type: { _eq: "user" }
              kind: { _in: ["topical", "state"] }
            }
          ) {
            id
          }
        }
        minerva_mail_filters(
          where: {
            accountId: { _eq: $accountId }
            fromAddress: { _eq: $fromAddress }
            label: { name: { _eq: $label } }
          }
        ) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts: { email: string; labels: { id: string }[] }[];
      minerva_mail_filters: { id: string }[];
    }>(query, { accountId, userId, label, fromAddress });
    const account = response.minerva_mail_accounts[0];
    if (!account) throw new NotFoundException(`No mail account ${accountId}`);
    const found = account.labels[0];
    if (!found) throw new NotFoundException(`No user label ${label}`);
    return {
      email: account.email,
      labelId: found.id,
      filtered: response.minerva_mail_filters.length > 0,
    };
  }
}
