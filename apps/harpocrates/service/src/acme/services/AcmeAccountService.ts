import { Injectable } from "@nestjs/common";
import * as jose from "jose";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import { acmePrincipal } from "../../auth/principal";
import type {
  AcmeAccount,
  AcmeAccountContact,
  Prisma,
} from "../../store/prisma";
import { PrismaService } from "../../store/PrismaService";
import { Acme } from "../AcmeProblem";
import type { VerifiedRequest } from "./AcmeJwsService";
import { AcmeUrls } from "./AcmeUrls";

/** An account as ACME shows it (RFC 8555 §7.1.2). */
export type AcmeAccountObject = {
  status: string;
  contact: string[];
  orders: string;
};

export type AccountAnswer = {
  status: 200 | 201;
  location: string;
  body: AcmeAccountObject;
};

type NewAccountPayload = {
  contact?: unknown;
  termsOfServiceAgreed?: unknown;
  onlyReturnExisting?: unknown;
  externalAccountBinding?: unknown;
};

const EAB_ALGORITHMS = ["HS256", "HS384", "HS512"];

/** mailto: URIs only, one address each (RFC 8555 §7.3). */
const checkContacts = (contact: unknown): string[] => {
  if (contact === undefined) return [];
  if (!Array.isArray(contact) || !contact.every((c) => typeof c === "string")) {
    throw Acme.malformed("contact is a list of URIs");
  }
  for (const uri of contact as string[]) {
    if (!uri.startsWith("mailto:")) {
      throw Acme.unsupportedContact(`${uri}: only mailto: contacts`);
    }
    const address = uri.slice("mailto:".length);
    if (!/^[^@\s,?]+@[^@\s,?]+$/.test(address)) {
      throw Acme.invalidContact(`${uri}: one address, no headers`);
    }
  }
  return [...new Set(contact as string[])];
};

/**
 * ACME accounts (RFC 8555 §7.3): registered only with an External Account
 * Binding credential (ADR 0020, ACME), which the account then holds, with
 * its name policy; one account per key and per credential.
 */
@Injectable()
export class AcmeAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly urls: AcmeUrls,
  ) {}

  /** new-account: register, or find the account the key already has. */
  async newAccount(request: VerifiedRequest): Promise<AccountAnswer> {
    const payload = (request.payload ?? {}) as NewAccountPayload;
    if (typeof payload !== "object" || payload === null) {
      throw Acme.malformed("The payload is not an object");
    }
    const jwk = request.jwk!;
    const thumbprint = await jose.calculateJwkThumbprint(jwk, "sha256");
    const existing = await this.prisma.acmeAccount.findUnique({
      where: { keyThumbprint: thumbprint },
      include: { contacts: true },
    });
    if (existing) {
      return {
        status: 200,
        location: this.urls.account(existing.id),
        body: this.object(existing),
      };
    }
    if (payload.onlyReturnExisting === true) {
      throw Acme.accountDoesNotExist("No account has this key");
    }
    const contacts = checkContacts(payload.contact);
    const credentialId = await this.checkBinding(
      payload.externalAccountBinding,
      thumbprint,
    );

    const account = await this.prisma.$transaction(async (tx) => {
      // Bound once: the key goes with the binding, in the same transaction
      // as the account, so a credential cannot register two.
      const bound = await tx.acmeEabCredential.updateMany({
        where: { id: credentialId, hmacKey: { not: null }, revokedAt: null },
        data: { hmacKey: null, boundAt: new Date() },
      });
      if (bound.count !== 1) {
        throw Acme.unauthorized("The credential is unknown, used or revoked");
      }
      const created = await tx.acmeAccount.create({
        data: {
          credentialId,
          keyThumbprint: thumbprint,
          publicKey: request.key.export({ format: "der", type: "spki" }),
          contacts: { createMany: { data: contacts.map((uri) => ({ uri })) } },
        },
        include: { contacts: true },
      });
      await this.audit.record(
        {
          kind: AuditKind.AcmeAccountCreated,
          principal: acmePrincipal(created.id),
          subjectType: "acme-account",
          subjectId: created.id,
          attributes: {
            credentialId,
            keyThumbprint: thumbprint,
            contacts: contacts.join(" ") || undefined,
          },
        },
        tx,
      );
      return created;
    });
    return {
      status: 201,
      location: this.urls.account(account.id),
      body: this.object(account),
    };
  }

  /** The account's own URL: describe (POST-as-GET), update or deactivate. */
  async account(
    accountId: string,
    request: VerifiedRequest,
  ): Promise<AcmeAccountObject> {
    const account = request.account!;
    if (account.id !== accountId) {
      throw Acme.unauthorized("An account changes only itself");
    }
    const payload = request.payload as
      { contact?: unknown; status?: unknown } | undefined;
    if (payload === undefined || Object.keys(payload).length === 0) {
      return this.object(await this.row(accountId));
    }
    if (payload.status !== undefined && payload.status !== "deactivated") {
      throw Acme.malformed("An account may only set its status to deactivated");
    }
    const contacts =
      payload.contact === undefined
        ? undefined
        : checkContacts(payload.contact);
    const updated = await this.prisma.$transaction(async (tx) => {
      const data: Prisma.AcmeAccountUpdateInput = {};
      if (payload.status === "deactivated") data.status = "deactivated";
      if (contacts) {
        await tx.acmeAccountContact.deleteMany({ where: { accountId } });
        data.contacts = {
          createMany: { data: contacts.map((uri) => ({ uri })) },
        };
      }
      const row = await tx.acmeAccount.update({
        where: { id: accountId },
        data,
        include: { contacts: true },
      });
      await this.audit.record(
        {
          kind:
            payload.status === "deactivated"
              ? AuditKind.AcmeAccountDeactivated
              : AuditKind.AcmeAccountUpdated,
          principal: acmePrincipal(accountId),
          subjectType: "acme-account",
          subjectId: accountId,
          attributes: { contacts: contacts?.join(" ") },
        },
        tx,
      );
      return row;
    });
    return this.object(updated);
  }

  /**
   * The External Account Binding (RFC 8555 §7.3.4): a JWS over the account
   * key, MACed with a credential's key, for this URL. Its credential's id.
   */
  private async checkBinding(
    binding: unknown,
    thumbprint: string,
  ): Promise<string> {
    if (binding === undefined) {
      throw Acme.externalAccountRequired(
        "Registration needs an External Account Binding: ask for a credential in the CA console",
      );
    }
    const jws = binding as Partial<jose.FlattenedJWS>;
    if (
      typeof jws !== "object" ||
      typeof jws.protected !== "string" ||
      typeof jws.payload !== "string" ||
      typeof jws.signature !== "string"
    ) {
      throw Acme.malformed("externalAccountBinding is not a flattened JWS");
    }
    let header: { alg?: string; kid?: string; url?: string; nonce?: string };
    try {
      header = JSON.parse(Buffer.from(jws.protected, "base64url").toString());
    } catch {
      throw Acme.malformed("The binding's protected header is not JSON");
    }
    if (!header.alg || !EAB_ALGORITHMS.includes(header.alg)) {
      throw Acme.malformed(
        `The binding is MACed with ${EAB_ALGORITHMS.join(", ")}`,
      );
    }
    if (header.nonce !== undefined) {
      throw Acme.malformed("The binding has no nonce");
    }
    if (header.url !== this.urls.newAccount()) {
      throw Acme.unauthorized("The binding is for another URL");
    }
    const credential = header.kid
      ? await this.prisma.acmeEabCredential.findUnique({
          where: { id: header.kid },
        })
      : null;
    if (!credential?.hmacKey || credential.revokedAt) {
      throw Acme.unauthorized("The credential is unknown, used or revoked");
    }
    let verified: jose.FlattenedVerifyResult;
    try {
      verified = await jose.flattenedVerify(
        jws as jose.FlattenedJWS,
        Buffer.from(credential.hmacKey, "base64url"),
        { algorithms: EAB_ALGORITHMS },
      );
    } catch {
      throw Acme.unauthorized("The binding's MAC does not verify");
    }
    let bound: jose.JWK;
    try {
      bound = JSON.parse(new TextDecoder().decode(verified.payload));
    } catch {
      throw Acme.malformed("The binding's payload is not a JWK");
    }
    if ((await jose.calculateJwkThumbprint(bound, "sha256")) !== thumbprint) {
      throw Acme.unauthorized("The binding is for another key");
    }
    return credential.id;
  }

  private async row(
    accountId: string,
  ): Promise<AcmeAccount & { contacts: AcmeAccountContact[] }> {
    return this.prisma.acmeAccount.findUniqueOrThrow({
      where: { id: accountId },
      include: { contacts: true },
    });
  }

  private object(
    account: AcmeAccount & { contacts: AcmeAccountContact[] },
  ): AcmeAccountObject {
    return {
      status: account.status,
      contact: account.contacts.map((c) => c.uri),
      orders: this.urls.orders(account.id),
    };
  }
}
