import { Injectable, Logger } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import {
  BASE_SESSION,
  SESSION_FOR_REFRESH,
  USER_WITH_ROLES,
} from "./queries/users";

/** A user who may sign in, with the roles their tokens will carry. */
export type DirectoryUser = {
  id: string;
  displayName: string;
  email: string;
  roles: string[];
};

export type GraphQlSession = {
  id: string;
  userId: string;
  clientId: string;
  /** The token's `auth_time`: when the provider sign-in completed. */
  createdTime: string;
  expiresTime: string;
  revokedTime: string | null;
};

type GraphQlUser = {
  id: string;
  displayName: string;
  email: string;
  disabled: boolean;
  roles: { role: string }[];
};

export type Resolution = { user: DirectoryUser } | { reason: string };

/**
 * What the provider told us about whoever just signed in.
 *
 * `emailVerified` is the provider's own claim and it is load-bearing: the
 * first sign-in links an identity to a user **by email**, so an
 * unverified address would let anyone who can set their profile email to
 * yours become you. It is a parameter rather than something the caller
 * checks, so that it cannot be forgotten at a call site.
 */
export type ProviderIdentity = {
  provider: string;
  /** The provider's stable identifier for the account. */
  subject: string;
  email: string;
  emailVerified: boolean;
};

/**
 * The form an address is compared in: the same expression the generated
 * column uses. Plus-addressing is deliberately not stripped — the local
 * part is opaque to everyone but the receiving server (RFC 5321), so
 * `a+b@x` and `a@x` are not reliably the same mailbox, and guessing costs
 * more than it saves.
 */
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase();

const user = (row: GraphQlUser): DirectoryUser => ({
  id: row.id,
  displayName: row.displayName,
  email: row.email,
  roles: row.roles.map((entry) => entry.role),
});

/**
 * Users, their provider identities and their sessions (ADR 0018). The only
 * part of the API that reads or writes them, and it does so through Hasura
 * like everything else.
 *
 * A user who does not already exist is refused. Signing in does not create
 * anyone: `pnpm --filter @ncfritz/olympus-api auth:user` does that, on
 * purpose, because a home lab's user list is short and deliberate.
 */
@Injectable()
export class UserDirectoryService {
  private readonly logger = new Logger(UserDirectoryService.name);

  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * The user behind a provider identity: by subject if we have seen it
   * before, otherwise by verified email, which links it.
   */
  async resolve(identity: ProviderIdentity): Promise<Resolution> {
    const known = await this.byIdentity(identity.provider, identity.subject);
    if (known !== undefined) {
      return known.disabled
        ? { reason: `user ${known.id} is disabled` }
        : { user: user(known) };
    }

    if (!identity.emailVerified) {
      return {
        reason: `${identity.provider} did not verify ${identity.email}`,
      };
    }

    const match = await this.byEmail(identity.email);
    if (match === undefined) {
      return { reason: `no user with the email ${identity.provider} gave` };
    }
    if (match.disabled) return { reason: `user ${match.id} is disabled` };

    await this.linkIdentity(match.id, identity);
    this.logger.log(
      `linked ${identity.provider} identity to user ${match.id} by email`,
    );
    return { user: user(match) };
  }

  private async byIdentity(
    provider: string,
    subject: string,
  ): Promise<GraphQlUser | undefined> {
    const query = gql`
      query DescribeUserByIdentity($provider: String!, $subject: String!) {
        olympus_user_identities(
          where: {
            provider: { _eq: $provider }
            subject: { _eq: $subject }
          }
          limit: 1
        ) {
          user {
            ${USER_WITH_ROLES}
          }
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      olympus_user_identities: { user: GraphQlUser }[];
    }>(query, { provider, subject });
    return response.olympus_user_identities[0]?.user;
  }

  /**
   * By email, exactly, against the column Postgres generates as
   * `lower(btrim(email))`. Equality rather than `_ilike`, which would treat
   * an underscore in an address as a wildcard and match someone else's; and
   * against the generated column rather than a normalized `email`, so the
   * casing a person typed is still theirs.
   *
   * Only the input is normalized here. The stored key is the database's job,
   * which is why nothing on the write path lowercases anything.
   */
  private async byEmail(email: string): Promise<GraphQlUser | undefined> {
    const query = gql`
      query DescribeUserByEmail($email: String!) {
        olympus_users(
          where: { emailNormalized: { _eq: $email } }
          limit: 1
        ) {
          ${USER_WITH_ROLES}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      olympus_users: GraphQlUser[];
    }>(query, { email: normalizeEmail(email) });
    return response.olympus_users[0];
  }

  private async linkIdentity(
    userId: string,
    identity: ProviderIdentity,
  ): Promise<void> {
    const mutation = gql`
      mutation CreateUserIdentity(
        $userId: uuid!
        $provider: String!
        $subject: String!
        $email: String!
      ) {
        insert_olympus_user_identities_one(
          object: {
            userId: $userId
            provider: $provider
            subject: $subject
            email: $email
          }
        ) {
          id
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      userId,
      provider: identity.provider,
      subject: identity.subject,
      // As the provider gave it: this is the audit trail, not a key.
      email: identity.email,
    });
  }

  /**
   * A user by id, with their roles as they are *now*.
   *
   * Read at every token issue and refresh rather than carried in the
   * authorization code, because that is what makes ADR 0018's promise true:
   * a role change or a disabling takes effect at the next refresh, within
   * the access token's ten minutes.
   */
  async describe(userId: string): Promise<Resolution> {
    const query = gql`
      query DescribeUser($userId: uuid!) {
        olympus_users_by_pk(id: $userId) {
          ${USER_WITH_ROLES}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      olympus_users_by_pk: GraphQlUser | null;
    }>(query, { userId });
    const row = response.olympus_users_by_pk;
    if (row === null) return { reason: `no user ${userId}` };
    if (row.disabled) return { reason: `user ${userId} is disabled` };
    return { user: user(row) };
  }

  /**
   * Records a session and returns when it began: the token's `auth_time`,
   * which refresh carries unchanged.
   */
  async createSession(session: {
    userId: string;
    clientId: string;
    deviceName?: string;
    refreshTokenHash: string;
    expiresAt: Date;
  }): Promise<{ id: string; createdTime: string }> {
    const mutation = gql`
      mutation CreateSession(
        $userId: uuid!
        $clientId: String!
        $deviceName: String
        $refreshTokenHash: String!
        $expiresTime: timestamptz!
      ) {
        insert_olympus_sessions_one(
          object: {
            userId: $userId
            clientId: $clientId
            deviceName: $deviceName
            refreshTokenHash: $refreshTokenHash
            expiresTime: $expiresTime
          }
        ) {
          id
          createdTime
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      insert_olympus_sessions_one: { id: string; createdTime: string };
    }>(mutation, {
      userId: session.userId,
      clientId: session.clientId,
      deviceName: session.deviceName ?? null,
      refreshTokenHash: session.refreshTokenHash,
      expiresTime: session.expiresAt.toISOString(),
    });
    return response.insert_olympus_sessions_one;
  }

  /**
   * The session a refresh token belongs to, by its hash — or, if the token
   * has already been rotated away, the session it *used* to belong to.
   *
   * Both in one query, because the second case is reuse detection and the
   * answer decides whether to rotate or to revoke. `matched` says which.
   */
  async findSessionByRefreshToken(hash: string): Promise<
    | {
        matched: "current" | "previous";
        session: GraphQlSession;
      }
    | undefined
  > {
    const query = gql`
      query DescribeSessionByRefreshToken($hash: String!) {
        current: olympus_sessions(
          where: { refreshTokenHash: { _eq: $hash } }
          limit: 1
        ) {
          ${SESSION_FOR_REFRESH}
        }
        previous: olympus_sessions(
          where: { previousTokenHash: { _eq: $hash } }
          limit: 1
        ) {
          ${SESSION_FOR_REFRESH}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      current: GraphQlSession[];
      previous: GraphQlSession[];
    }>(query, { hash });
    const current = response.current[0];
    if (current !== undefined) return { matched: "current", session: current };
    const previous = response.previous[0];
    if (previous !== undefined) {
      return { matched: "previous", session: previous };
    }
    return undefined;
  }

  /**
   * Swaps a session's refresh token for a new one, keeping the old hash as
   * `previousTokenHash` so that presenting it again is detectable.
   *
   * Conditional on the hash still being the current one, and it reports
   * whether it changed anything. Two refreshes racing with the same token
   * would otherwise both rotate, and the chain would lose a link: this way
   * exactly one wins, and the loser's token is now a *previous* hash, which
   * is reuse by ADR 0018's definition.
   */
  async rotateSession(
    sessionId: string,
    expectedHash: string,
    nextHash: string,
  ): Promise<boolean> {
    const mutation = gql`
      mutation RotateSession(
        $id: uuid!
        $expected: String!
        $next: String!
        $now: timestamptz!
      ) {
        update_olympus_sessions(
          where: { id: { _eq: $id }, refreshTokenHash: { _eq: $expected } }
          _set: {
            refreshTokenHash: $next
            previousTokenHash: $expected
            lastUsedTime: $now
          }
        ) {
          affected_rows
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      update_olympus_sessions: { affected_rows: number };
    }>(mutation, {
      id: sessionId,
      expected: expectedHash,
      next: nextHash,
      now: new Date().toISOString(),
    });
    return response.update_olympus_sessions.affected_rows === 1;
  }

  /** Ends a session: reuse detection, or signing out. */
  async revokeSession(sessionId: string): Promise<void> {
    const mutation = gql`
      mutation RevokeSession($id: uuid!, $now: timestamptz!) {
        update_olympus_sessions(
          where: { id: { _eq: $id }, revokedTime: { _is_null: true } }
          _set: { revokedTime: $now }
        ) {
          affected_rows
        }
      }
    `;
    await this.graphQLClient.request(mutation, {
      id: sessionId,
      now: new Date().toISOString(),
    });
  }

  /** A user's live sessions, newest first (ListSessions, step 8). */
  async listSessions(userId: string): Promise<unknown[]> {
    const query = gql`
      query ListSessions($userId: uuid!) {
        olympus_sessions(
          where: { userId: { _eq: $userId }, revokedTime: { _is_null: true } }
          order_by: { createdTime: desc }
        ) {
          ${BASE_SESSION}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      olympus_sessions: unknown[];
    }>(query, { userId });
    return response.olympus_sessions;
  }
}
