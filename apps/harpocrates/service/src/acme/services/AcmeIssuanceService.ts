import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { X509Certificate } from "crypto";
import { acmePrincipal, type Principal, SYSTEM } from "../../auth/principal";
import { CertificateService } from "../../certificates/services/CertificateService";
import { acmeConfig, type AcmeConfigType } from "../../config/configuration";
import type { RevocationReasonName } from "../../model/certificates";
import { parseCsr } from "../../pki/x509";
import { PrismaService } from "../../store/PrismaService";
import { Acme, AcmeProblem } from "../AcmeProblem";
import type { VerifiedRequest } from "./AcmeJwsService";
import { AcmeOrderService } from "./AcmeOrderService";

/** CRLReason codes (RFC 5280 §5.3.1) a subscriber may give (RFC 8555 §7.6). */
const REASONS: Record<number, RevocationReasonName> = {
  0: "unspecified",
  1: "keyCompromise",
  3: "affiliationChanged",
  4: "superseded",
  5: "cessationOfOperation",
  9: "privilegeWithdrawn",
};

const pemOf = (der: string): string =>
  `-----BEGIN CERTIFICATE REQUEST-----\n${
    Buffer.from(der, "base64url")
      .toString("base64")
      .match(/.{1,64}/g)
      ?.join("\n") ?? ""
  }\n-----END CERTIFICATE REQUEST-----\n`;

/** What the certificate service said, as ACME says it. */
const problemOf = (
  error: unknown,
  fallback: (detail: string) => AcmeProblem,
) => {
  if (error instanceof AcmeProblem) return error;
  if (error instanceof ServiceUnavailableException) {
    return new AcmeProblem("serverInternal", 503, error.message);
  }
  if (error instanceof HttpException && error.getStatus() < 500) {
    return fallback(error.message);
  }
  return error;
};

/**
 * Issuance (RFC 8555 §7.4–7.6): a ready order finalized with a CSR for
 * exactly its names, issued under ACME_PROFILE by the certificate service
 * (the profile's rules, the signer's invariants and name constraints);
 * the certificate with its chain; and revocation by the account that
 * ordered it, or by the certificate's own key.
 */
@Injectable()
export class AcmeIssuanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: AcmeOrderService,
    private readonly certificates: CertificateService,
    @Inject(acmeConfig.KEY) private readonly config: AcmeConfigType,
  ) {}

  async finalize(
    orderId: string,
    request: VerifiedRequest,
  ): Promise<Record<string, unknown>> {
    const account = request.account!;
    const order = await this.orders.ownOrder(orderId, account);
    if (order.status !== "ready") {
      throw Acme.orderNotReady(
        order.status === "pending"
          ? "Its authorizations are not all valid yet"
          : `The order is ${order.status}`,
      );
    }
    const payload = request.payload as { csr?: unknown } | undefined;
    if (typeof payload?.csr !== "string" || !payload.csr) {
      throw Acme.malformed("Finalizing takes a csr");
    }
    const pem = pemOf(payload.csr);
    let csr;
    try {
      csr = await parseCsr(pem);
    } catch {
      throw Acme.badCSR("The CSR does not parse");
    }
    const ordered = order.authorizations.map((a) => a.identifier).sort();
    const asked = [
      ...new Set(
        csr.names
          .filter((n) => n.type === "dns")
          .map((n) => n.value.toLowerCase()),
      ),
    ].sort();
    if (
      csr.names.some((n) => n.type !== "dns") ||
      asked.join(" ") !== ordered.join(" ")
    ) {
      throw Acme.badCSR(
        `The CSR must name exactly the order's names: ${ordered.join(", ")}`,
      );
    }
    const commonName = /^CN=([^,+]+)$/.exec(csr.subject)?.[1]?.toLowerCase();
    if (csr.subject && !commonName) {
      throw Acme.badCSR(
        "The CSR's subject may hold a common name, nothing else",
      );
    }
    if (commonName && !ordered.includes(commonName)) {
      throw Acme.badCSR(`The CSR's common name ${commonName} is not ordered`);
    }

    const claimed = await this.prisma.acmeOrder.updateMany({
      where: { id: orderId, status: "ready" },
      data: { status: "processing" },
    });
    if (claimed.count !== 1) {
      throw Acme.orderNotReady("The order is being finalized already");
    }
    try {
      const certificate = await this.certificates.create(
        acmePrincipal(account.id),
        {
          profileId: this.config.profileId,
          subject: { commonName: commonName ?? ordered[0] },
          names: { dns: ordered },
          csr: pem,
        },
      );
      await this.prisma.acmeOrder.update({
        where: { id: orderId },
        data: { status: "valid", certificateId: certificate.id },
      });
    } catch (error) {
      // Another CSR may do: the order is ready again.
      await this.prisma.acmeOrder.update({
        where: { id: orderId },
        data: { status: "ready" },
      });
      throw problemOf(error, Acme.badCSR);
    }
    return this.orders.orderObject(
      await this.orders.ownOrder(orderId, account),
    );
  }

  /** The certificate and the CAs above it, not the root (§7.4.2). */
  async certificateChain(
    certificateId: string,
    request: VerifiedRequest,
  ): Promise<string> {
    const order = await this.prisma.acmeOrder.findUnique({
      where: { certificateId },
    });
    if (!order || order.accountId !== request.account!.id) {
      throw Acme.unauthorized("The certificate was not issued to this account");
    }
    const chain = await this.certificates.download(certificateId, "chain");
    return String(chain.body);
  }

  /**
   * revoke-cert (§7.6): signed by the account it was issued to (kid), or
   * by its own key (jwk), with a reason a subscriber may give.
   */
  async revoke(request: VerifiedRequest): Promise<void> {
    const payload = request.payload as
      { certificate?: unknown; reason?: unknown } | undefined;
    if (typeof payload?.certificate !== "string") {
      throw Acme.malformed("Revoking takes a certificate");
    }
    let presented: X509Certificate;
    try {
      presented = new X509Certificate(
        Buffer.from(payload.certificate, "base64url"),
      );
    } catch {
      throw Acme.malformed("The certificate does not parse");
    }
    const reasonCode = payload.reason === undefined ? 0 : payload.reason;
    const reason =
      typeof reasonCode === "number" ? REASONS[reasonCode] : undefined;
    if (!reason) {
      throw Acme.badRevocationReason(
        `${String(reasonCode)} is not a reason a subscriber gives: 0, 1, 3, 4, 5 or 9`,
      );
    }
    const serial = presented.serialNumber.toLowerCase().replace(/^0+/, "");
    const row = (
      await this.prisma.certificate.findMany({
        where: { serial },
        include: { acmeOrder: true },
      })
    ).find((c) => Buffer.from(c.der).equals(presented.raw));
    if (!row)
      throw Acme.malformed("The certificate is not one Harpocrates issued");

    let principal: Principal;
    if (request.account) {
      if (row.acmeOrder?.accountId !== request.account.id) {
        throw Acme.unauthorized(
          "The certificate was not issued to this account: sign with its key",
        );
      }
      principal = acmePrincipal(request.account.id);
    } else {
      const certified = presented.publicKey.export({
        format: "der",
        type: "spki",
      });
      const signer = request.key.export({ format: "der", type: "spki" });
      if (!certified.equals(signer)) {
        throw Acme.unauthorized("The request is signed with another key");
      }
      principal = { ...SYSTEM, id: `certificate:${serial}`, surface: "acme" };
    }
    if (row.status === "revoked") {
      throw Acme.alreadyRevoked("The certificate is already revoked");
    }
    try {
      await this.certificates.revoke(principal, row.id, {
        reason,
        comment: "Revoked through ACME",
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw Acme.alreadyRevoked(error.message);
      }
      throw problemOf(error, Acme.malformed);
    }
  }
}
