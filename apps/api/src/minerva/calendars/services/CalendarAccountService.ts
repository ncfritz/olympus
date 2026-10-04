import type {
  CalendarAccount,
  CalendarAccountSignIn,
  CalendarProvider,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import moment from "moment";
import { authConfig, type AuthConfigType } from "../../../config/configuration";
import {
  type GraphQlCalendarAccount,
  toCalendarAccount,
} from "../converters/CalendarConverter";
import { CALENDAR_ACCOUNT } from "../queries/calendarAccounts";
import {
  callbackUrlFor,
  decideLink,
  hashState,
  isClientPage,
  newSignInSecrets,
  SIGN_IN_LIFETIME_MS,
  withOutcome,
} from "../utils/signIns";
import {
  type AgentCalendarAccount,
  type AgentProvider,
  MinervaCalendarAgentClient,
} from "./MinervaCalendarAgentClient";

const PROVIDERS: readonly string[] = ["google", "microsoft"];

type GraphQlConnection = {
  id: string;
  userId: string;
  provider: string;
  codeVerifier: string;
  accountId: string | null;
  returnTo: string;
  expiresTime: string;
  completedTime: string | null;
  account: GraphQlCalendarAccount | null;
};

const notFound = (accountId: string) =>
  new NotFoundException(`Calendar account with id ${accountId} not found`);

/**
 * The user's calendar accounts (ADR 0028): which of the accounts the sync
 * agent holds are theirs, and the provider sign-ins that prove it. The
 * agent keeps the credentials; this keeps ownership, in
 * minerva.calendar_accounts, and the sign-ins in flight.
 */
@Injectable()
export class CalendarAccountService {
  private readonly logger = new Logger(CalendarAccountService.name);

  constructor(
    private readonly graphQLClient: GraphQLClient,
    private readonly agent: MinervaCalendarAgentClient,
    @Inject(authConfig.KEY) private readonly auth: AuthConfigType,
  ) {}

  /**
   * The user's accounts, each with its credential's state. Records the
   * accounts the agent holds first, and links to the user those that are
   * their sign-in identities (ADR 0028, way 1). Without the agent the
   * accounts are still listed, their state unknown.
   */
  async list(userId: string): Promise<CalendarAccount[]> {
    const agentAccounts = await this.agentAccounts();
    if (agentAccounts) {
      await this.record(agentAccounts);
      await this.linkSignInIdentities(userId);
    }
    const rows = await this.owned(userId);
    return rows.map((row) =>
      toCalendarAccount(
        row,
        agentAccounts?.find(
          (a) => a.provider === row.provider && a.subject === row.subject,
        ),
        agentAccounts !== undefined,
      ),
    );
  }

  /** @throws NotFoundException for an account that is not the user's */
  async describe(userId: string, accountId: string): Promise<CalendarAccount> {
    const row = await this.requireOwned(userId, accountId);
    const agentAccounts = await this.agentAccounts();
    return toCalendarAccount(
      row,
      agentAccounts?.find(
        (a) => a.provider === row.provider && a.subject === row.subject,
      ),
      agentAccounts !== undefined,
    );
  }

  /** The user's account by ID, for the calendar operations. @throws NotFoundException */
  async requireOwned(
    userId: string,
    accountId: string,
  ): Promise<GraphQlCalendarAccount> {
    const query = gql`
      query DescribeCalendarAccount($id: uuid!, $userId: uuid!) {
        minerva_calendar_accounts(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
          limit: 1
        ) {
          ${CALENDAR_ACCOUNT}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_calendar_accounts: GraphQlCalendarAccount[];
    }>(query, { id: accountId, userId });
    const row = response.minerva_calendar_accounts[0];
    if (!row) throw notFound(accountId);
    return row;
  }

  /** Every account the user owns. */
  async owned(userId: string): Promise<GraphQlCalendarAccount[]> {
    const query = gql`
      query ListCalendarAccounts($userId: uuid!) {
        minerva_calendar_accounts(
          where: { userId: { _eq: $userId } }
          order_by: [{ provider: asc }, { email: asc }]
        ) {
          ${CALENDAR_ACCOUNT}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_calendar_accounts: GraphQlCalendarAccount[];
    }>(query, { userId });
    return response.minerva_calendar_accounts;
  }

  /**
   * Starts a sign-in at the provider that connects a new account to the
   * user (ADR 0028, way 2). @throws BadRequestException for a provider or
   * page that is not allowed
   */
  async connect(
    userId: string,
    provider: unknown,
    returnTo: unknown,
  ): Promise<CalendarAccountSignIn> {
    const problems: string[] = [];
    if (typeof provider !== "string" || !PROVIDERS.includes(provider)) {
      problems.push(`provider must be one of ${PROVIDERS.join(", ")}`);
    }
    if (!isClientPage(returnTo, this.auth.users.clientOrigins)) {
      problems.push("returnTo must be a page of one of the API's clients");
    }
    if (problems.length) throw new BadRequestException(problems);
    return this.startSignIn(
      userId,
      provider as AgentProvider,
      returnTo as string,
    );
  }

  /** Starts a sign-in at the provider for one of the user's accounts. @throws NotFoundException */
  async reauthorize(
    userId: string,
    accountId: string,
    returnTo: unknown,
  ): Promise<CalendarAccountSignIn> {
    if (!isClientPage(returnTo, this.auth.users.clientOrigins)) {
      throw new BadRequestException([
        "returnTo must be a page of one of the API's clients",
      ]);
    }
    const account = await this.requireOwned(userId, accountId);
    return this.startSignIn(
      userId,
      account.provider as AgentProvider,
      returnTo,
      account,
    );
  }

  /**
   * The provider's redirect: redeems it through the agent and links the
   * account to the user who started the sign-in, unless it is another
   * user's. Returns where to send the browser: the site page, with the
   * outcome in its query.
   *
   * @throws BadRequestException when no sign-in is waiting for the state,
   *   so there is nowhere safe to send the browser
   */
  async complete(
    provider: string,
    query: Record<string, string>,
  ): Promise<string> {
    const state = query["state"];
    if (!state) throw new BadRequestException("state is required");
    const connection = await this.takeConnection(state);
    if (!connection || connection.provider !== provider) {
      throw new BadRequestException("no sign-in is waiting for that state");
    }
    const back = (outcome: Record<string, string>) =>
      withOutcome(connection.returnTo, outcome);

    if (moment.utc(connection.expiresTime).isBefore(moment.utc())) {
      return back({ calendarAccount: "expired" });
    }
    if (query["error"]) {
      this.logger.log(`${provider} sign-in returned ${query["error"]}`);
      return back({ calendarAccount: "cancelled" });
    }

    const redirectUri = this.redirectUri(provider);
    let result;
    try {
      result = await this.agent.completeWebSignIn({
        provider: provider as AgentProvider,
        callbackUrl: `${redirectUri}?${new URLSearchParams(query).toString()}`,
        redirectUri,
        state,
        codeVerifier: connection.codeVerifier,
        accountLabel: connection.account?.email,
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        return back({ calendarAccount: "refused", reason: "another-account" });
      }
      this.logger.warn(
        `${provider} sign-in failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return back({ calendarAccount: "failed" });
    }

    if (!result.subject) {
      if (result.created) await this.forget(result);
      this.logger.warn(
        `${provider} gave no subject for ${result.accountLabel}`,
      );
      return back({ calendarAccount: "failed" });
    }

    const existing = await this.bySubject(result.provider, result.subject);
    const decision = decideLink({
      userId: connection.userId,
      ownerId: existing?.userId ?? undefined,
      identityOwnerId: await this.identityOwner(
        result.provider,
        result.subject,
      ),
    });
    if (!decision.link) {
      this.logger.warn(
        `refused linking ${provider} account ${result.accountLabel}: ${decision.reason}`,
      );
      if (result.created) await this.forget(result);
      return back({ calendarAccount: "refused", reason: "owned" });
    }

    const accountId = await this.link(
      connection.userId,
      result.provider,
      result.subject,
      result.accountLabel,
      decision.alreadyTheirs,
    );
    return back({ calendarAccount: "connected", accountId });
  }

  /**
   * Stops syncing the account's calendars, deletes its credential at the
   * agent and its meetings in Minerva. The user's notes, their meeting
   * links and associations stay. @throws NotFoundException
   */
  async remove(userId: string, accountId: string): Promise<void> {
    const account = await this.requireOwned(userId, accountId);
    try {
      await this.agent.deleteCalendarAccount(
        account.provider as AgentProvider,
        account.email,
      );
    } catch (error) {
      // An account the agent no longer holds is already gone there.
      if (!(error instanceof NotFoundException)) throw error;
    }
    const mutation = gql`
      mutation RemoveCalendarAccount($id: uuid!, $userId: uuid!) {
        delete_minerva_meetings(
          where: { account_id: { _eq: $id }, user_id: { _eq: $userId } }
        ) {
          affected_rows
        }
        delete_minerva_calendar_accounts(
          where: { id: { _eq: $id }, userId: { _eq: $userId } }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, { id: accountId, userId });
  }

  private async startSignIn(
    userId: string,
    provider: AgentProvider,
    returnTo: string,
    account?: GraphQlCalendarAccount,
  ): Promise<CalendarAccountSignIn> {
    const redirectUri = this.redirectUri(provider);
    const secrets = newSignInSecrets();
    const mutation = gql`
      mutation CreateCalendarAccountConnection(
        $object: minerva_calendar_account_connections_insert_input!
      ) {
        insert_minerva_calendar_account_connections_one(object: $object) {
          id
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      object: {
        userId,
        provider,
        stateHash: secrets.stateHash,
        codeVerifier: secrets.codeVerifier,
        accountId: account?.id ?? null,
        returnTo,
        expiresTime: new Date(Date.now() + SIGN_IN_LIFETIME_MS).toISOString(),
      },
    });
    const authUrl = await this.agent.startWebSignIn({
      provider,
      redirectUri,
      state: secrets.state,
      codeChallenge: secrets.codeChallenge,
      ...(account ? { accountLabel: account.email } : {}),
    });
    return { authUrl };
  }

  /**
   * The waiting sign-in of `state`, taken: marked completed, so a replayed
   * callback finds nothing. Undefined when there is none, or it was taken.
   */
  private async takeConnection(
    state: string,
  ): Promise<GraphQlConnection | undefined> {
    const mutation = gql`
      mutation TakeCalendarAccountConnection(
        $stateHash: String!
        $now: timestamptz!
      ) {
        update_minerva_calendar_account_connections(
          where: {
            stateHash: { _eq: $stateHash }
            completedTime: { _is_null: true }
          }
          _set: { completedTime: $now }
        ) {
          returning {
            id
            userId
            provider
            codeVerifier
            accountId
            returnTo
            expiresTime
            completedTime
            account {
              ${CALENDAR_ACCOUNT}
            }
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_minerva_calendar_account_connections: {
        returning: GraphQlConnection[];
      };
    }>(mutation, {
      stateHash: hashState(state),
      now: new Date().toISOString(),
    });
    return response.update_minerva_calendar_account_connections.returning[0];
  }

  private redirectUri(provider: string): string {
    const base = this.auth.users.publicBaseUrl;
    if (!base) {
      throw new ServiceUnavailableException(
        "AUTH_PUBLIC_BASE_URL is not set, so there is no callback to sign in through",
      );
    }
    return callbackUrlFor(base, provider);
  }

  /** The agent's accounts, or undefined when it cannot be asked. */
  private async agentAccounts(): Promise<AgentCalendarAccount[] | undefined> {
    try {
      return await this.agent.listCalendarAccounts();
    } catch (error) {
      this.logger.warn(
        `Calendar accounts listed without the agent: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  /** Records every account the agent holds that has a subject, owned or not. */
  private async record(accounts: AgentCalendarAccount[]): Promise<void> {
    const objects = accounts
      .filter((a) => a.subject)
      .map((a) => ({
        provider: a.provider,
        subject: a.subject,
        email: a.accountLabel,
      }));
    if (!objects.length) return;
    const mutation = gql`
      mutation RecordCalendarAccounts(
        $objects: [minerva_calendar_accounts_insert_input!]!
      ) {
        insert_minerva_calendar_accounts(
          objects: $objects
          on_conflict: {
            constraint: calendar_accounts_provider_subject_key
            update_columns: [email]
          }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, { objects });
  }

  /** Links to the user the unowned accounts that are their sign-in identities. */
  private async linkSignInIdentities(userId: string): Promise<void> {
    const query = gql`
      query ListUserIdentities($userId: uuid!) {
        olympus_user_identities(where: { userId: { _eq: $userId } }) {
          provider
          subject
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      olympus_user_identities: { provider: string; subject: string }[];
    }>(query, { userId });
    const identities = response.olympus_user_identities.filter((i) =>
      PROVIDERS.includes(i.provider),
    );
    if (!identities.length) return;
    const mutation = gql`
      mutation LinkSignInIdentities(
        $where: minerva_calendar_accounts_bool_exp!
        $userId: uuid!
        $now: timestamptz!
      ) {
        update_minerva_calendar_accounts(
          where: $where
          _set: {
            userId: $userId
            verifiedTime: $now
            verificationMethod: "sign_in"
          }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      userId,
      now: new Date().toISOString(),
      where: {
        userId: { _is_null: true },
        _or: identities.map((i) => ({
          provider: { _eq: i.provider },
          subject: { _eq: i.subject },
        })),
      },
    });
  }

  private async bySubject(
    provider: string,
    subject: string,
  ): Promise<GraphQlCalendarAccount | undefined> {
    const query = gql`
      query DescribeCalendarAccountBySubject(
        $provider: String!
        $subject: String!
      ) {
        minerva_calendar_accounts(
          where: { provider: { _eq: $provider }, subject: { _eq: $subject } }
          limit: 1
        ) {
          ${CALENDAR_ACCOUNT}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_calendar_accounts: GraphQlCalendarAccount[];
    }>(query, { provider, subject });
    return response.minerva_calendar_accounts[0];
  }

  /** The user who signs in to Olympus with this account, if any. */
  private async identityOwner(
    provider: string,
    subject: string,
  ): Promise<string | undefined> {
    const query = gql`
      query DescribeIdentityOwner($provider: String!, $subject: String!) {
        olympus_user_identities(
          where: { provider: { _eq: $provider }, subject: { _eq: $subject } }
          limit: 1
        ) {
          userId
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      olympus_user_identities: { userId: string }[];
    }>(query, { provider, subject });
    return response.olympus_user_identities[0]?.userId;
  }

  /**
   * Records the account as the user's: proven by this sign-in, unless it
   * already was theirs (its proof stays). Returns its ID.
   */
  private async link(
    userId: string,
    provider: CalendarProvider | AgentProvider,
    subject: string,
    email: string,
    alreadyTheirs: boolean,
  ): Promise<string> {
    const mutation = gql`
      mutation LinkCalendarAccount(
        $object: minerva_calendar_accounts_insert_input!
        $columns: [minerva_calendar_accounts_update_column!]!
      ) {
        insert_minerva_calendar_accounts_one(
          object: $object
          on_conflict: {
            constraint: calendar_accounts_provider_subject_key
            update_columns: $columns
          }
        ) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      insert_minerva_calendar_accounts_one: { id: string };
    }>(mutation, {
      object: {
        provider,
        subject,
        email,
        userId,
        verifiedTime: new Date().toISOString(),
        verificationMethod: "consent",
      },
      columns: alreadyTheirs
        ? ["email"]
        : ["email", "userId", "verifiedTime", "verificationMethod"],
    });
    return response.insert_minerva_calendar_accounts_one.id;
  }

  /** Deletes a credential the agent stored for a sign-in that was refused. */
  private async forget(result: {
    provider: AgentProvider;
    accountLabel: string;
  }): Promise<void> {
    try {
      await this.agent.deleteCalendarAccount(
        result.provider,
        result.accountLabel,
      );
    } catch (error) {
      this.logger.error(
        `Could not delete the refused ${result.provider} credential of ${result.accountLabel}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
