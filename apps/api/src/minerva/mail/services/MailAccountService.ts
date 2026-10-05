import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MailAccount } from "@ncfritz/olympus-model";
import { gql, GraphQLClient } from "graphql-request";
import { normalizeEmail } from "../../../auth/users/UserDirectoryService";
import {
  GraphQlMailAccount,
  toDomainObject,
} from "../converters/MailAccountConverter";

const ACCOUNT_FIELDS = `
  id
  userId
  email
  verificationMethod
  verifiedTime
`;

/** A mailbox address, as the account table holds it. */
const ADDRESS = /^[^@\s]+@[^@\s]+$/;

export const toMailboxAddress = (email: unknown): string => {
  const address =
    typeof email === "string" ? email.trim().toLowerCase() : undefined;
  if (!address || !ADDRESS.test(address) || address.length > 320) {
    throw new BadRequestException("email must be an email address");
  }
  return address;
};

/**
 * Mail accounts (ADR 0030). An account imported from a Takeout archive is
 * the user's the operator named: importing it is an agent's operation,
 * not a user's, and needs no proof from the provider. Linking by consent
 * arrives with phase 1b.
 */
@Injectable()
export class MailAccountService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /**
   * The account for `email`, made the user's if it is new. Importing the
   * same mailbox again for the same user answers the same account.
   *
   * @throws NotFoundException no user has `ownerEmail`
   * @throws ConflictException the mailbox is already another user's
   */
  async import(email: unknown, ownerEmail: unknown): Promise<MailAccount> {
    const address = toMailboxAddress(email);
    if (typeof ownerEmail !== "string" || !ownerEmail.trim()) {
      throw new BadRequestException("ownerEmail is required");
    }
    const owner = await this.userByEmail(ownerEmail);
    if (!owner) {
      throw new NotFoundException(`No user has the email ${ownerEmail}`);
    }

    const existing = await this.byAddress(address);
    if (existing) {
      if (existing.userId !== owner) {
        throw new ConflictException(
          `The mailbox ${address} is already another user's`,
        );
      }
      return toDomainObject(existing);
    }

    const mutation = gql`
      mutation ImportMailAccount($account: minerva_mail_accounts_insert_input!) {
        insert_minerva_mail_accounts_one(object: $account) {
          ${ACCOUNT_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      insert_minerva_mail_accounts_one: GraphQlMailAccount;
    }>(mutation, {
      account: {
        userId: owner,
        email: address,
        verificationMethod: "import",
        verifiedTime: new Date().toISOString(),
      },
    });
    return toDomainObject(response.insert_minerva_mail_accounts_one);
  }

  private async byAddress(
    address: string,
  ): Promise<GraphQlMailAccount | undefined> {
    const query = gql`
      query DescribeMailAccountByEmail($email: String!) {
        minerva_mail_accounts(
          where: { provider: { _eq: "google" }, email: { _eq: $email } }
          limit: 1
        ) {
          ${ACCOUNT_FIELDS}
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      minerva_mail_accounts: GraphQlMailAccount[];
    }>(query, { email: address });
    return response.minerva_mail_accounts[0];
  }

  /** The ID of the user with that email, compared as the directory does. */
  private async userByEmail(email: string): Promise<string | undefined> {
    const query = gql`
      query DescribeMailAccountOwner($email: String!) {
        olympus_users(where: { emailNormalized: { _eq: $email } }, limit: 1) {
          id
        }
      }
    `;
    const response = await this.graphQLClient.request<{
      olympus_users: { id: string }[];
    }>(query, { email: normalizeEmail(email) });
    return response.olympus_users[0]?.id;
  }
}
