import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ListMailStarMismatchesResponse,
  MailStarFix,
  MailStarIcon,
} from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";

export const MAX_STAR_PAGE = 500;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GraphQlMismatch = {
  accountId: string;
  gmailId: string;
  receivedTime: string;
  label: string;
  stateOpen: boolean;
  starred: boolean;
  starIcon: string | null;
  fix: string;
  account: { attentionStar: string; doneStar: string };
  message: { fromAddress: string | null; subject: string | null };
};

const count = (n: { aggregate: { count: number } }) => n.aggregate.count;

/**
 * Stars as states (docs/plans/email-management phase 7 step 1): the
 * messages whose state and star disagree, from `mail_star_mismatches`.
 * Starring one is an ordinary change batch adding STARRED; an icon is set
 * in Gmail by hand, and the next sync records it.
 */
@Injectable()
export class MailStarService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * A page of the user's mismatches, newest first, and the counts of each
   * fix across the other filters.
   *
   * @throws BadRequestException a filter is not what it should be
   */
  async mismatches(
    userId: string,
    query: {
      accountId?: string;
      fix?: MailStarFix;
      offset: number;
      limit: number;
    },
  ): Promise<ListMailStarMismatchesResponse> {
    const { accountId, fix, offset, limit } = query;
    if (accountId !== undefined && !UUID.test(accountId)) {
      throw new BadRequestException("accountId must be an ID");
    }
    if (fix !== undefined && !Object.values(MailStarFix).includes(fix)) {
      throw new BadRequestException(
        `fix must be one of ${Object.values(MailStarFix).join(", ")}`,
      );
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new BadRequestException("offset must not be negative");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_STAR_PAGE) {
      throw new BadRequestException(
        `limit must be between 1 and ${MAX_STAR_PAGE}`,
      );
    }
    const base = {
      account: { userId: { _eq: userId } },
      ...(accountId ? { accountId: { _eq: accountId } } : {}),
    };
    const listQuery = gql`
      query ListMailStarMismatches(
        $where: minerva_mail_star_mismatches_bool_exp!
        $base: minerva_mail_star_mismatches_bool_exp!
        $offset: Int!
        $limit: Int!
      ) {
        minerva_mail_star_mismatches(
          where: $where
          order_by: [{ receivedTime: desc }, { gmailId: asc }]
          offset: $offset
          limit: $limit
        ) {
          accountId
          gmailId
          receivedTime
          label
          stateOpen
          starred
          starIcon
          fix
          account {
            attentionStar
            doneStar
          }
          message {
            fromAddress
            subject
          }
        }
        matching: minerva_mail_star_mismatches_aggregate(where: $where) {
          aggregate {
            count
          }
        }
        star: minerva_mail_star_mismatches_aggregate(
          where: { _and: [$base, { fix: { _eq: "star" } }] }
        ) {
          aggregate {
            count
          }
        }
        attentionIcon: minerva_mail_star_mismatches_aggregate(
          where: { _and: [$base, { fix: { _eq: "attention-icon" } }] }
        ) {
          aggregate {
            count
          }
        }
        doneIcon: minerva_mail_star_mismatches_aggregate(
          where: { _and: [$base, { fix: { _eq: "done-icon" } }] }
        ) {
          aggregate {
            count
          }
        }
      }
    `;
    type Count = { aggregate: { count: number } };
    const response = await this.graphQLClient.request<{
      minerva_mail_star_mismatches: GraphQlMismatch[];
      matching: Count;
      star: Count;
      attentionIcon: Count;
      doneIcon: Count;
    }>(listQuery, {
      where: { ...base, ...(fix ? { fix: { _eq: fix } } : {}) },
      base,
      offset,
      limit,
    });
    return {
      mismatches: response.minerva_mail_star_mismatches.map((m) => ({
        accountId: m.accountId,
        gmailId: m.gmailId,
        ...(m.message.fromAddress
          ? { fromAddress: m.message.fromAddress }
          : {}),
        ...(m.message.subject ? { subject: m.message.subject } : {}),
        receivedTime: moment(m.receivedTime),
        label: m.label,
        stateOpen: m.stateOpen,
        starred: m.starred,
        ...(m.starIcon ? { starIcon: m.starIcon as MailStarIcon } : {}),
        fix: m.fix as MailStarFix,
        wanted: (m.stateOpen
          ? m.account.attentionStar
          : m.account.doneStar) as MailStarIcon,
      })),
      count: count(response.matching),
      counts: {
        star: count(response.star),
        attentionIcon: count(response.attentionIcon),
        doneIcon: count(response.doneIcon),
      },
    };
  }
}
