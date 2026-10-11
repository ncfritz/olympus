import { Inject, Injectable } from "@nestjs/common";
import { acmeConfig, type AcmeConfigType } from "../../config/configuration";

/**
 * The ACME resources' URLs (RFC 8555 §7.1): absolute, under ACME_BASE_URL,
 * as clients are given them and must sign them (a JWS's `url`).
 */
@Injectable()
export class AcmeUrls {
  constructor(
    @Inject(acmeConfig.KEY) private readonly config: AcmeConfigType,
  ) {}

  get base(): string {
    return this.config.baseUrl;
  }

  directory = () => `${this.base}/acme/directory`;
  newNonce = () => `${this.base}/acme/new-nonce`;
  newAccount = () => `${this.base}/acme/new-account`;
  newOrder = () => `${this.base}/acme/new-order`;
  revokeCert = () => `${this.base}/acme/revoke-cert`;
  keyChange = () => `${this.base}/acme/key-change`;
  renewalInfo = () => `${this.base}/acme/renewal-info`;
  account = (id: string) => `${this.base}/acme/account/${id}`;
  orders = (accountId: string) => `${this.account(accountId)}/orders`;
  order = (id: string) => `${this.base}/acme/order/${id}`;
  finalize = (orderId: string) => `${this.order(orderId)}/finalize`;
  authorization = (id: string) => `${this.base}/acme/authorization/${id}`;
  challenge = (id: string) => `${this.base}/acme/challenge/${id}`;
  certificate = (id: string) => `${this.base}/acme/certificate/${id}`;

  /** The account id a `kid` names, if it is one of ours. */
  accountIdOf(kid: string): string | undefined {
    const prefix = `${this.base}/acme/account/`;
    if (!kid.startsWith(prefix)) return undefined;
    const id = kid.slice(prefix.length);
    return /^[0-9a-f-]{36}$/.test(id) ? id : undefined;
  }
}
