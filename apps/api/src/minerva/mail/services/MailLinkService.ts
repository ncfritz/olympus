import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MailAccount } from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { authConfig, type AuthConfigType } from "../../../config/configuration";
import {
  hashState,
  isClientPage,
  newSignInSecrets,
  SIGN_IN_LIFETIME_MS,
  withOutcome,
} from "../../calendars/utils/signIns";
import {
  GraphQlMailAccount,
  toDomainObject,
} from "../converters/MailAccountConverter";
import {
  type AgentGmailSignIn,
  MinervaMailAgentClient,
} from "./MinervaMailAgentClient";

const ACCOUNT_FIELDS = `
  id
  userId
  email
  verificationMethod
  verifiedTime
  linkedTime
  linkScope
  googleSubject
`;

type LinkedAccount = GraphQlMailAccount & { googleSubject: string | null };

type GraphQlConnection = {
  id: string;
  userId: string;
  accountId: string;
  codeVerifier: string;
  returnTo: string;
  expiresTime: string;
  account: LinkedAccount;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The API's callback for Gmail sign-ins, registered with Google. */
export const mailCallbackUrlFor = (publicBaseUrl: string): string =>
  `${publicBaseUrl.replace(/\/+$/, "")}/v1/minerva/mail/accounts/callback`;

/**
 * Linking a mail account to Gmail (docs/plans/email-management phase 1b;
 * ADR 0030 by ADR 0028's consent flow): the API starts the sign-in for the
 * account's owner, keeps its state's hash and the PKCE verifier, and on
 * Google's redirect takes the sign-in once and hands the code to the mail
 * agent, which holds the client secret and the refresh token. The account
 * is the mailbox imported from Takeout: the sign-in must be its address,
 * and once linked, its Google subject.
 */
@Injectable()
export class MailLinkService {
  private readonly logger = new Logger(MailLinkService.name);

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly agent: MinervaMailAgentClient,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  /** The user's mail accounts, by address. */
  async list(userId: string): Promise<MailAccount[]> {
    const query = gql`
      query ListMailAccounts($userId: uuid!) {
        minerva_mail_accounts(
          where: { userId: { _eq: $userId } }
          order_by: { email: asc }
        ) {
          ${ACCOUNT_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts: LinkedAccount[];
    }>(query, { userId });
    return response.minerva_mail_accounts.map(toDomainObject);
  }

  /**
   * Starts a sign-in to link (or re-link) the user's account: Google's URL
   * for the browser.
   *
   * @throws BadRequestException returnTo is not a page of the API's clients
   * @throws NotFoundException the account is not the user's
   */
  async connect(
    userId: string,
    accountId: string,
    returnTo: unknown,
  ): Promise<string> {
    if (!UUID.test(accountId)) {
      throw new BadRequestException("accountId must be a mail account ID");
    }
    if (!isClientPage(returnTo, this.auth.users.clientOrigins)) {
      throw new BadRequestException([
        "returnTo must be a page of one of the API's clients",
      ]);
    }
    const account = await this.owned(userId, accountId);
    const redirectUri = this.redirectUri();
    const secrets = newSignInSecrets();
    const mutation = gql`
      mutation CreateMailAccountConnection(
        $connection: minerva_mail_account_connections_insert_input!
      ) {
        insert_minerva_mail_account_connections_one(object: $connection) {
          id
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      connection: {
        userId,
        accountId,
        stateHash: secrets.stateHash,
        codeVerifier: secrets.codeVerifier,
        returnTo,
        expiresTime: new Date(Date.now() + SIGN_IN_LIFETIME_MS).toISOString(),
      },
    });
    return this.agent.startSignIn({
      redirectUri,
      state: secrets.state,
      codeChallenge: secrets.codeChallenge,
      email: account.email,
    });
  }

  /**
   * Google's redirect: redeems it through the agent and links the account.
   * Returns where to send the browser: the site page, with the outcome in
   * its query (mailAccount=connected, cancelled, expired, refused with a
   * reason, or failed).
   *
   * @throws BadRequestException no sign-in is waiting for the state, so
   *   there is nowhere safe to send the browser
   */
  async complete(query: Record<string, string>): Promise<string> {
    const state = query["state"];
    if (!state) throw new BadRequestException("state is required");
    const connection = await this.take(state);
    if (!connection) {
      throw new BadRequestException("no sign-in is waiting for that state");
    }
    const back = (outcome: Record<string, string>) =>
      withOutcome(connection.returnTo, outcome);
    if (moment.utc(connection.expiresTime).isBefore(moment.utc())) {
      return back({ mailAccount: "expired" });
    }
    if (query["error"]) {
      this.logger.log(`Gmail sign-in returned ${query["error"]}`);
      return back({ mailAccount: "cancelled" });
    }

    const account = connection.account;
    const redirectUri = this.redirectUri();
    let result: AgentGmailSignIn;
    try {
      result = await this.agent.completeSignIn({
        callbackUrl: `${redirectUri}?${new URLSearchParams(query).toString()}`,
        redirectUri,
        state,
        codeVerifier: connection.codeVerifier,
        email: account.email,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        return back({ mailAccount: "refused", reason: "another-account" });
      }
      this.logger.warn(
        `Gmail sign-in failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return back({ mailAccount: "failed" });
    }

    // The agent checked its own credential's subject; Olympus checks its
    // record, which outlives a credential the agent lost.
    if (account.googleSubject && account.googleSubject !== result.subject) {
      this.logger.warn(
        `Refused linking ${account.email}: another Google account than before`,
      );
      if (result.created) await this.forget(account.email);
      return back({ mailAccount: "refused", reason: "another-account" });
    }
    if (await this.subjectElsewhere(result.subject, account.id)) {
      this.logger.warn(
        `Refused linking ${account.email}: its Google account is another mail account's`,
      );
      if (result.created) await this.forget(account.email);
      return back({ mailAccount: "refused", reason: "owned" });
    }

    const link = gql`
      mutation LinkMailAccount(
        $id: uuid!
        $userId: uuid!
        $subject: String!
        $scope: String!
        $now: timestamptz!
      ) {
        update_minerva_mail_accounts(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
          _set: { googleSubject: $subject, linkScope: $scope, linkedTime: $now }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(link, {
      id: account.id,
      userId: connection.userId,
      subject: result.subject,
      scope: result.scope,
      now: new Date().toISOString(),
    });
    return back({ mailAccount: "connected", accountId: account.id });
  }

  private redirectUri(): string {
    const base = this.auth.users.publicBaseUrl;
    if (!base) {
      throw new ServiceUnavailableException(
        "AUTH_PUBLIC_BASE_URL is not set, so there is no callback to sign in through",
      );
    }
    return mailCallbackUrlFor(base);
  }

  private async owned(
    userId: string,
    accountId: string,
  ): Promise<LinkedAccount> {
    const query = gql`
      query DescribeOwnedMailAccount($id: uuid!, $userId: uuid!) {
        minerva_mail_accounts(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
        ) {
          ${ACCOUNT_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts: LinkedAccount[];
    }>(query, { id: accountId, userId });
    const account = response.minerva_mail_accounts[0];
    if (!account) throw new NotFoundException(`No mail account ${accountId}`);
    return account;
  }

  /** The waiting sign-in of `state`, taken so a replay finds nothing. */
  private async take(state: string): Promise<GraphQlConnection | undefined> {
    const mutation = gql`
      mutation TakeMailAccountConnection($stateHash: String!, $now: timestamptz!) {
        update_minerva_mail_account_connections(
          where: { stateHash: { _eq: $stateHash }, completedTime: { _is_null: true } }
          _set: { completedTime: $now }
        ) {
          returning {
            id
            userId
            accountId
            codeVerifier
            returnTo
            expiresTime
            account {
              ${ACCOUNT_FIELDS}
            }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_minerva_mail_account_connections: {
        returning: GraphQlConnection[];
      };
    }>(mutation, {
      stateHash: hashState(state),
      now: new Date().toISOString(),
    });
    return response.update_minerva_mail_account_connections.returning[0];
  }

  private async subjectElsewhere(
    subject: string,
    accountId: string,
  ): Promise<boolean> {
    const query = gql`
      query DescribeMailAccountBySubject($subject: String!, $id: uuid!) {
        minerva_mail_accounts(
          where: { googleSubject: { _eq: $subject }, id: { _neq: $id } }
        ) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts: { id: string }[];
    }>(query, { subject, id: accountId });
    return response.minerva_mail_accounts.length > 0;
  }

  /** Drops a credential the agent took for a sign-in that was refused. */
  private async forget(email: string): Promise<void> {
    try {
      await this.agent.deleteAccount(email);
    } catch (error) {
      this.logger.warn(
        `Could not drop ${email}'s credential at the mail agent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
