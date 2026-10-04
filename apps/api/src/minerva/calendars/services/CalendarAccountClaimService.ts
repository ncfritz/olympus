import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  NotificationChannel,
  notificationRoute,
  publishMessage,
  type SmtpNotificationEvent,
} from "@ncfritz/olympus-messages";
import type {
  CalendarAccount,
  CalendarAccountClaim,
  CalendarAccountClaimReceipt,
  CalendarProvider,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { v4 as uuidv4 } from "uuid";
import { RateLimiter } from "../../../auth/limits/RateLimiter";
import {
  authConfig,
  type AuthConfigType,
  minervaConfig,
  type MinervaConfigType,
} from "../../../config/configuration";
import type { GraphQlCalendarAccount } from "../converters/CalendarConverter";
import { CALENDAR_ACCOUNT } from "../queries/calendarAccounts";
import {
  CLAIM_LIFETIME_MS,
  CLAIM_LIMIT,
  claimLink,
  CLAIM_NOTIFICATION_TYPE,
  type ClaimEmailContext,
  claimState,
  isEmailAddress,
  likeExactly,
  newClaimToken,
} from "../utils/claims";
import { hashState, isClientPage } from "../utils/signIns";
import { CalendarAccountService } from "./CalendarAccountService";
import type { AgentProvider } from "./MinervaCalendarAgentClient";

type GraphQlClaim = {
  id: string;
  userId: string;
  expiresTime: string;
  confirmedTime: string | null;
  cancelledTime: string | null;
  account: GraphQlCalendarAccount;
};

/**
 * Claims on calendar accounts the agent holds without an owner (ADR 0028,
 * way 3): a link mailed to the account's address, which the claimant
 * confirms signed in.
 */
@Injectable()
export class CalendarAccountClaimService {
  private readonly logger = new Logger(CalendarAccountClaimService.name);
  private readonly limiter = new RateLimiter();

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
    private readonly accounts: CalendarAccountService,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
    @Inject(minervaConfig.KEY) private readonly minerva: MinervaConfigType,
  ) {}

  /**
   * Claims the unowned accounts with this address and mails each a link.
   * Answers the same whether or not there are any, so a claim does not say
   * which accounts exist; and counts toward the claimant's limit either way.
   *
   * @throws BadRequestException, ServiceUnavailableException when no From
   *   is configured, HttpException 429 over the limit
   */
  async create(
    userId: string,
    email: unknown,
    confirmPage: unknown,
  ): Promise<CalendarAccountClaimReceipt> {
    const problems: string[] = [];
    const address = typeof email === "string" ? email.trim() : "";
    if (!isEmailAddress(address)) problems.push("email must be an address");
    if (!isClientPage(confirmPage, this.auth.users.clientOrigins)) {
      problems.push("confirmPage must be a page of one of the API's clients");
    }
    if (problems.length) throw new BadRequestException(problems);
    const from = this.minerva.claimMailFrom;
    if (!from) {
      throw new ServiceUnavailableException(
        "MINERVA_CLAIM_MAIL_FROM is not set, so no claim email can be sent",
      );
    }
    this.checkLimit(userId);

    for (const account of await this.claimable(address)) {
      const identityOwner = await this.accounts.identityOwner(
        account.provider,
        account.subject,
      );
      // Another user signs in to Olympus with it: theirs to link, and
      // nothing to tell this user.
      if (identityOwner !== undefined && identityOwner !== userId) continue;
      await this.claim(userId, account, confirmPage as string, from);
    }
    return { email: address };
  }

  /**
   * The claim of `token`, for its claimant to confirm. Changes nothing: a
   * mail scanner may open the link.
   *
   * @throws NotFoundException, ForbiddenException for another user,
   *   GoneException once expired, confirmed or cancelled
   */
  async describe(userId: string, token: string): Promise<CalendarAccountClaim> {
    const claim = await this.requireOpen(userId, token);
    return {
      provider: claim.account.provider as CalendarProvider,
      email: claim.account.email,
      expiresTime: moment.utc(claim.expiresTime),
    };
  }

  /**
   * Links the claimed account to its claimant (`claim_email`) and asks the
   * agent for its earlier events.
   *
   * @throws as describe(), and ConflictException when the account has
   *   found another owner since
   */
  async confirm(userId: string, token: string): Promise<CalendarAccount> {
    const claim = await this.requireOpen(userId, token);
    const { account } = claim;
    const identityOwner = await this.accounts.identityOwner(
      account.provider,
      account.subject,
    );
    if (identityOwner !== undefined && identityOwner !== userId) {
      throw new ConflictException(
        "The account is another user's sign-in identity",
      );
    }

    const now = new Date().toISOString();
    const take = gql`
      mutation TakeCalendarAccountClaim($id: uuid!, $now: timestamptz!) {
        update_minerva_calendar_account_claims(
          where: {
            id: { _eq: $id }
            confirmedTime: { _is_null: true }
            cancelledTime: { _is_null: true }
            expiresTime: { _gt: $now }
          }
          _set: { confirmedTime: $now }
        ) {
          affected_rows
        }
      }
    `;
    const taken = await this.graphQLClient.request<{
      update_minerva_calendar_account_claims: { affected_rows: number };
    }>(take, { id: claim.id, now });
    if (taken.update_minerva_calendar_account_claims.affected_rows === 0) {
      throw new GoneException("The claim has expired or was already used");
    }

    const link = gql`
      mutation LinkClaimedCalendarAccount(
        $id: uuid!
        $userId: uuid!
        $now: timestamptz!
      ) {
        update_minerva_calendar_accounts(
          where: { id: { _eq: $id }, userId: { _is_null: true } }
          _set: {
            userId: $userId
            verifiedTime: $now
            verificationMethod: "claim_email"
          }
        ) {
          affected_rows
        }
      }
    `;
    const linked = await this.graphQLClient.request<{
      update_minerva_calendar_accounts: { affected_rows: number };
    }>(link, { id: account.id, userId, now });
    if (linked.update_minerva_calendar_accounts.affected_rows === 0) {
      throw new ConflictException("The account already has an owner");
    }

    await this.accounts.backfill(
      account.provider as AgentProvider,
      account.email,
    );
    return this.accounts.describe(userId, account.id);
  }

  /**
   * Makes an account unowned again (`admin`): its owner's meetings from it
   * are deleted, as removing it would; their notes, meeting links and
   * associations stay. Open claims on it are cancelled. The agent keeps
   * its credential, so it can be claimed again.
   *
   * @throws NotFoundException
   */
  async release(accountId: string): Promise<void> {
    const mutation = gql`
      mutation ReleaseCalendarAccount($id: uuid!, $now: timestamptz!) {
        update_minerva_calendar_accounts(
          where: { id: { _eq: $id } }
          _set: { userId: null, verifiedTime: null, verificationMethod: null }
        ) {
          affected_rows
        }
        delete_minerva_meetings(where: { account_id: { _eq: $id } }) {
          affected_rows
        }
        update_minerva_calendar_account_claims(
          where: {
            accountId: { _eq: $id }
            confirmedTime: { _is_null: true }
            cancelledTime: { _is_null: true }
          }
          _set: { cancelledTime: $now }
        ) {
          affected_rows
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_minerva_calendar_accounts: { affected_rows: number };
    }>(mutation, { id: accountId, now: new Date().toISOString() });
    if (response.update_minerva_calendar_accounts.affected_rows === 0) {
      throw new NotFoundException(
        `Calendar account with id ${accountId} not found`,
      );
    }
  }

  private checkLimit(userId: string): void {
    if (this.auth.rateLimits === "off") return;
    const decision = this.limiter.check(
      "CreateCalendarAccountClaim",
      userId,
      CLAIM_LIMIT,
    );
    if (!decision.allowed) {
      throw new HttpException(
        `Too many claims; try again in ${Math.ceil(decision.retryAfterSeconds / 3600)} hours`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** The unowned accounts with this address, whatever its case. */
  private async claimable(email: string): Promise<GraphQlCalendarAccount[]> {
    const query = gql`
      query ListClaimableCalendarAccounts($email: String!) {
        minerva_calendar_accounts(
          where: { email: { _ilike: $email }, userId: { _is_null: true } }
        ) {
          ${CALENDAR_ACCOUNT}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_calendar_accounts: GraphQlCalendarAccount[];
    }>(query, { email: likeExactly(email) });
    return response.minerva_calendar_accounts;
  }

  /** Opens a claim, cancelling the account's previous one, and mails it. */
  private async claim(
    userId: string,
    account: GraphQlCalendarAccount,
    confirmPage: string,
    from: string,
  ): Promise<void> {
    const token = newClaimToken();
    const now = new Date();
    const expires = new Date(now.getTime() + CLAIM_LIFETIME_MS);
    const mutation = gql`
      mutation CreateCalendarAccountClaim(
        $accountId: uuid!
        $now: timestamptz!
        $claim: minerva_calendar_account_claims_insert_input!
      ) {
        update_minerva_calendar_account_claims(
          where: {
            accountId: { _eq: $accountId }
            confirmedTime: { _is_null: true }
            cancelledTime: { _is_null: true }
          }
          _set: { cancelledTime: $now }
        ) {
          affected_rows
        }
        insert_minerva_calendar_account_claims_one(object: $claim) {
          id
        }
      }
    `;
    // One request, one transaction: the previous claim is cancelled only
    // if this one is opened.
    const created = await this.graphQLClient.request<{
      insert_minerva_calendar_account_claims_one: { id: string };
    }>(mutation, {
      accountId: account.id,
      now: now.toISOString(),
      claim: {
        accountId: account.id,
        userId,
        tokenHash: token.hash,
        expiresTime: expires.toISOString(),
      },
    });
    const claimId = created.insert_minerva_calendar_account_claims_one.id;
    const claimant = await this.claimant(userId);

    const context: ClaimEmailContext = {
      claimantName: claimant.displayName,
      claimantEmail: claimant.email,
      provider: account.provider,
      accountEmail: account.email,
      link: claimLink(confirmPage, token.value),
      expiresTime: expires.toISOString(),
    };
    const message: SmtpNotificationEvent<ClaimEmailContext> = {
      eventId: uuidv4(),
      notificationId: claimId,
      notificationType: CLAIM_NOTIFICATION_TYPE,
      publishTime: now.toISOString(),
      // A link that no longer works is not worth delivering.
      expirationTime: expires.toISOString(),
      priority: "3",
      from,
      to: [account.email],
      context,
    };
    try {
      await publishMessage(
        this.amqpConnection,
        notificationRoute(NotificationChannel.EMAIL),
        message,
      );
    } catch (error) {
      // The answer stays the same; the claimant can claim again.
      this.logger.error(
        `Could not send the claim email for calendar account ${account.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async claimant(
    userId: string,
  ): Promise<{ displayName: string; email: string }> {
    const query = gql`
      query DescribeCalendarAccountClaimant($id: uuid!) {
        olympus_users_by_pk(id: $id) {
          displayName
          email
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      olympus_users_by_pk: { displayName: string; email: string } | null;
    }>(query, { id: userId });
    return (
      response.olympus_users_by_pk ?? {
        displayName: "An Olympus user",
        email: "",
      }
    );
  }

  /** The claim of `token`, if it is the user's and still open. */
  private async requireOpen(
    userId: string,
    token: string,
  ): Promise<GraphQlClaim> {
    const query = gql`
      query DescribeCalendarAccountClaim($tokenHash: String!) {
        minerva_calendar_account_claims(
          where: { tokenHash: { _eq: $tokenHash } }
          limit: 1
        ) {
          id
          userId
          expiresTime
          confirmedTime
          cancelledTime
          account {
            ${CALENDAR_ACCOUNT}
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_calendar_account_claims: GraphQlClaim[];
    }>(query, { tokenHash: hashState(token) });
    const claim = response.minerva_calendar_account_claims[0];
    if (!claim) throw new NotFoundException("No claim has that link");
    if (claim.userId !== userId) {
      throw new ForbiddenException(
        "This claim was made by another Olympus user; only they can confirm it, signed in as themselves",
      );
    }
    const state = claimState(claim, new Date());
    if (state !== "open") {
      throw new GoneException(`The claim was ${state}`);
    }
    if (claim.account.userId) {
      throw new ConflictException("The account already has an owner");
    }
    return claim;
  }
}
