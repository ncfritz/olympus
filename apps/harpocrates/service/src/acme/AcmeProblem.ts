/**
 * ACME's errors (RFC 8555 §6.7): problem documents (RFC 7807) whose type
 * is `urn:ietf:params:acme:error:<type>`, served as
 * application/problem+json.
 */
export const ACME_ERROR = "urn:ietf:params:acme:error:";

export type AcmeIdentifier = { type: string; value: string };

export type AcmeProblemDocument = {
  type: string;
  detail: string;
  status: number;
  /** Per identifier, for an order refused for some of its names (§6.7.1). */
  subproblems?: (AcmeProblemDocument & { identifier: AcmeIdentifier })[];
  /** badSignatureAlgorithm: what is accepted (§6.2). */
  algorithms?: string[];
};

/** An ACME error, thrown anywhere under an ACME route. */
export class AcmeProblem extends Error {
  constructor(
    readonly type: string,
    readonly status: number,
    detail: string,
    readonly extra: Pick<
      AcmeProblemDocument,
      "subproblems" | "algorithms"
    > = {},
    /** Headers the answer carries: a conflict's Location. */
    readonly headers: Record<string, string> = {},
  ) {
    super(detail);
    this.name = "AcmeProblem";
  }

  document(): AcmeProblemDocument {
    return {
      type: `${ACME_ERROR}${this.type}`,
      detail: this.message,
      status: this.status,
      ...this.extra,
    };
  }
}

const problem =
  (type: string, status: number) =>
  (detail: string, extra?: AcmeProblem["extra"]) =>
    new AcmeProblem(type, status, detail, extra);

export const Acme = {
  malformed: problem("malformed", 400),
  badNonce: problem("badNonce", 400),
  badSignatureAlgorithm: problem("badSignatureAlgorithm", 400),
  badPublicKey: problem("badPublicKey", 400),
  badCSR: problem("badCSR", 400),
  badRevocationReason: problem("badRevocationReason", 400),
  alreadyRevoked: problem("alreadyRevoked", 400),
  invalidContact: problem("invalidContact", 400),
  unsupportedContact: problem("unsupportedContact", 400),
  unsupportedIdentifier: problem("unsupportedIdentifier", 400),
  rejectedIdentifier: problem("rejectedIdentifier", 400),
  accountDoesNotExist: problem("accountDoesNotExist", 400),
  externalAccountRequired: problem("externalAccountRequired", 400),
  orderNotReady: problem("orderNotReady", 403),
  unauthorized: problem("unauthorized", 403),
  connection: problem("connection", 400),
  incorrectResponse: problem("incorrectResponse", 403),
  tls: problem("tls", 400),
  dns: problem("dns", 400),
  serverInternal: problem("serverInternal", 500),
};
