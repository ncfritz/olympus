import { gql, GraphQLClient } from "graphql-request";
import { normalizeEmail } from "./UserDirectoryService";
import { ADMIN_USER } from "./queries/users";

/** A user as the administration CLI shows them. */
export interface AdminUser {
  id: string;
  displayName: string;
  email: string;
  disabled: boolean;
  roles: string[];
  /** Which providers this user has signed in with, and as whom. */
  identities: { provider: string; subject: string; email: string }[];
}

interface GraphQlAdminUser {
  id: string;
  displayName: string;
  email: string;
  disabled: boolean;
  roles: { role: string }[];
  identities: { provider: string; subject: string; email: string }[];
}

/**
 * A role name, as the guard will compare it: exactly, so `Admin` and
 * `admin` are two different roles and one of them is a typo nobody notices
 * until an endpoint refuses someone. Constrained here rather than in the
 * database, because the useful error is at the keyboard.
 */
const ROLE = /^[a-z][a-z0-9-]*$/;

/** A uuid, to tell "which user" apart from an email address. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const admin = (row: GraphQlAdminUser): AdminUser => ({
  id: row.id,
  displayName: row.displayName,
  email: row.email,
  disabled: row.disabled,
  roles: row.roles.map((entry) => entry.role).sort(),
  identities: row.identities,
});

/** Thrown for anything the operator can fix; the CLI prints it plainly. */
export class UserAdministrationError extends Error {}

/**
 * Reads and writes the user directory for the `auth:user` CLI.
 *
 * Signing in never creates anyone (see {@link UserDirectoryService}), so
 * this is the only way a user comes to exist. That is the whole point: a
 * home lab's user list is short and deliberate, and an account appearing
 * because somebody authenticated somewhere else is not a thing that should
 * be able to happen.
 *
 * Not an `@Injectable`: nothing in the running API administers users, and a
 * provider the app does not need is a provider that can be reached by
 * accident.
 */
export class UserAdministration {
  constructor(private readonly client: GraphQLClient) {}

  async list(): Promise<AdminUser[]> {
    const query = gql`
      query ListUsers {
        olympus_users(order_by: { email: asc }) {
          ${ADMIN_USER}
        }
      }
    `;
    const response = await this.client.request<{
      olympus_users: GraphQlAdminUser[];
    }>(query);
    return response.olympus_users.map(admin);
  }

  /**
   * One user, by id or by email. Email goes through the generated column,
   * so the casing an operator types does not have to match what is stored.
   */
  async find(who: string): Promise<AdminUser | undefined> {
    const query = UUID.test(who)
      ? gql`
          query DescribeAdminUserById($id: uuid!) {
            olympus_users(where: { id: { _eq: $id } }, limit: 1) {
              ${ADMIN_USER}
            }
          }
        `
      : gql`
          query DescribeAdminUserByEmail($email: String!) {
            olympus_users(
              where: { emailNormalized: { _eq: $email } }
              limit: 1
            ) {
              ${ADMIN_USER}
            }
          }
        `;
    const response = await this.client.request<{
      olympus_users: GraphQlAdminUser[];
    }>(query, UUID.test(who) ? { id: who } : { email: normalizeEmail(who) });
    return response.olympus_users[0] === undefined
      ? undefined
      : admin(response.olympus_users[0]);
  }

  /** As {@link find}, but the operator meant a user that exists. */
  async require(who: string): Promise<AdminUser> {
    const found = await this.find(who);
    if (found === undefined) {
      throw new UserAdministrationError(`no user matches ${who}`);
    }
    return found;
  }

  /**
   * Creates a user, with their roles, in one mutation — Hasura runs the
   * fields of a mutation in one transaction, so a user is never left
   * without the roles they were asked to have.
   *
   * The duplicate check below is a courtesy: the unique index on the
   * generated column is what actually guarantees it, and it is the thing
   * that still holds when two of these run at once.
   */
  async add(details: {
    email: string;
    displayName: string;
    roles: string[];
  }): Promise<AdminUser> {
    const roles = checkRoles(details.roles);
    const email = details.email.trim();
    if (email === "" || !email.includes("@")) {
      throw new UserAdministrationError(`${details.email} is not an email`);
    }
    if (details.displayName.trim() === "") {
      throw new UserAdministrationError("a display name is required");
    }

    const existing = await this.find(email);
    if (existing !== undefined) {
      throw new UserAdministrationError(
        `${existing.email} is already user ${existing.id}`,
      );
    }

    const mutation = gql`
      mutation CreateUser(
        $email: String!
        $displayName: String!
        $roles: [olympus_user_roles_insert_input!]!
      ) {
        insert_olympus_users_one(
          object: {
            email: $email
            displayName: $displayName
            roles: { data: $roles }
          }
        ) {
          ${ADMIN_USER}
        }
      }
    `;
    const response = await this.client.request<{
      insert_olympus_users_one: GraphQlAdminUser;
    }>(mutation, {
      // As typed: the generated column is the key, this is what a person
      // recognizes as their address.
      email,
      displayName: details.displayName.trim(),
      roles: roles.map((role) => ({ role })),
    });
    return admin(response.insert_olympus_users_one);
  }

  /**
   * Replaces a user's roles with exactly these. Delete then insert, in one
   * mutation and so in one transaction: a user is never briefly roleless,
   * which on a system where roles gate endpoints would be a moment of
   * being locked out.
   */
  async setRoles(userId: string, roles: string[]): Promise<string[]> {
    const wanted = checkRoles(roles);
    const mutation = gql`
      mutation SetUserRoles(
        $userId: uuid!
        $roles: [olympus_user_roles_insert_input!]!
      ) {
        delete_olympus_user_roles(where: { userId: { _eq: $userId } }) {
          affected_rows
        }
        insert_olympus_user_roles(objects: $roles) {
          affected_rows
        }
      }
    `;
    await this.client.request(mutation, {
      userId,
      roles: wanted.map((role) => ({ userId, role })),
    });
    return wanted;
  }

  /**
   * Disables or re-enables a user. A disabled user is refused at sign-in
   * and at every refresh, so their access ends within the access token's
   * ten minutes rather than at its expiry — which is why this exists
   * instead of deleting them.
   */
  async setDisabled(userId: string, disabled: boolean): Promise<void> {
    const mutation = gql`
      mutation SetUserDisabled($userId: uuid!, $disabled: Boolean!) {
        update_olympus_users_by_pk(
          pk_columns: { id: $userId }
          _set: { disabled: $disabled }
        ) {
          id
        }
      }
    `;
    await this.client.request(mutation, { userId, disabled });
  }

  /**
   * Forgets a provider identity, so the next sign-in with it links again by
   * verified email. For when a provider was configured wrongly and linked
   * the wrong account — not a routine operation.
   */
  async unlink(userId: string, provider: string): Promise<number> {
    const mutation = gql`
      mutation DeleteUserIdentity($userId: uuid!, $provider: String!) {
        delete_olympus_user_identities(
          where: { userId: { _eq: $userId }, provider: { _eq: $provider } }
        ) {
          affected_rows
        }
      }
    `;
    const response = await this.client.request<{
      delete_olympus_user_identities: { affected_rows: number };
    }>(mutation, { userId, provider });
    return response.delete_olympus_user_identities.affected_rows;
  }
}

/** Every role, checked and de-duplicated, in a stable order. */
const checkRoles = (roles: string[]): string[] => {
  const bad = roles.filter((role) => !ROLE.test(role));
  if (bad.length > 0) {
    throw new UserAdministrationError(
      `not role names (lower case, starting with a letter): ${bad.join(", ")}`,
    );
  }
  return [...new Set(roles)].sort();
};
