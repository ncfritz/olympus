import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import { CertificateService } from "../../certificates/services/CertificateService";
import type {
  FullCertificate,
  RenewPresentedCertificateRequest,
} from "../../model/certificates";
import { certificatePem, parseCertificate, parseCsr } from "../../pki/x509";
import { PrismaService } from "../../store/PrismaService";

/** The common name of an RFC 4514 subject. */
const commonNameOf = (subject: string): string | undefined =>
  /(?:^|,)CN=((?:\\.|[^,])*)/.exec(subject)?.[1];

/**
 * Renewal over mutual TLS (ADR 0020, Renewal and delivery): a service, a
 * device or a host presents the certificate it holds and gets its renewal
 * back, the same subject and profile, with or without a new key. Whether
 * it may is Harpocrates's own record of that certificate, not a
 * revocation list: one it issued, byte for byte, current, not revoked,
 * not already renewed.
 */
@Injectable()
export class RenewalService {
  private readonly logger = new Logger(RenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certificates: CertificateService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Renews the presented certificate. @throws UnauthorizedException for
   * no certificate, one Harpocrates did not issue, or one revoked or
   * expired; ForbiddenException for one asking to renew another
   * certificate, or another subject, or already renewed
   */
  async renewPresented(
    presented: Buffer | undefined,
    request: RenewPresentedCertificateRequest,
  ): Promise<FullCertificate> {
    if (!presented) {
      throw new UnauthorizedException("No client certificate was presented");
    }
    const parsed = parseCertificate(certificatePem(presented));
    const row = await this.prisma.certificate.findFirst({
      where: { serial: parsed.serial },
      include: { revocation: true, renewedBy: true },
    });
    // Byte for byte: a certificate another CA issued with the same serial
    // is not this one, whatever it says.
    if (!row || !Buffer.from(row.der).equals(presented)) {
      this.logger.warn(
        `Refused a renewal: ${parsed.subject} (${parsed.serial}) is not a certificate Harpocrates issued`,
      );
      throw new UnauthorizedException(
        "The client certificate is not one Harpocrates issued",
      );
    }
    const now = new Date();
    if (row.revocation || row.status === "revoked") {
      throw new UnauthorizedException("The client certificate is revoked");
    }
    if (row.notAfter <= now || row.notBefore > now) {
      throw new UnauthorizedException(
        "The client certificate is not currently valid",
      );
    }

    const principal: Principal = {
      id: `certificate:${row.serial}`,
      roles: [],
      authTime: 0,
      surface: "renewal",
    };
    const refuse = async (reason: string): Promise<never> => {
      await this.audit.record({
        kind: AuditKind.RequestRefused,
        principal,
        reason,
        subjectType: "certificate",
        subjectId: row.id,
        attributes: { operation: "renew" },
      });
      throw new ForbiddenException(reason);
    };

    if (request.certificateId && request.certificateId !== row.id) {
      await refuse(
        "A certificate renews only itself: present the certificate being renewed",
      );
    }
    if (row.renewedBy) {
      await refuse(
        `This certificate was already renewed by ${row.renewedBy.id}: present that one`,
      );
    }
    if (request.csr) {
      const csr = await parseCsr(request.csr);
      const asked = commonNameOf(csr.subject);
      if (asked !== undefined && asked !== commonNameOf(row.subject)) {
        await refuse(
          `The CSR asks for ${csr.subject}, not this certificate's subject ${row.subject}`,
        );
      }
    }
    return this.certificates.renew(principal, row.id, { csr: request.csr });
  }
}
