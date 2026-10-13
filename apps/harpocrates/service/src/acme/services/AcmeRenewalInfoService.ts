import { Injectable } from "@nestjs/common";
import * as x509 from "@peculiar/x509";
import { PrismaService } from "../../store/PrismaService";
import { Acme, AcmeProblem } from "../AcmeProblem";
import { renewalWindowOf } from "../renewalWindow";

/** How long a client waits before asking again (RFC 9773 §4.3). */
export const RENEWAL_INFO_RETRY_SECONDS = 6 * 60 * 60;

export type RenewalInfo = {
  suggestedWindow: { start: string; end: string };
};

/**
 * ACME Renewal Information (RFC 9773, ADR 0020): when a certificate should
 * be renewed. Normally from its profile's renewal age to half-way to its
 * expiry; for a revoked one, a window already past, so the client renews
 * now.
 */
@Injectable()
export class AcmeRenewalInfoService {
  constructor(private readonly prisma: PrismaService) {}

  async renewalInfo(certId: string): Promise<RenewalInfo> {
    const [aki, serialPart] = certId.split(".");
    if (!aki || !serialPart || certId.split(".").length !== 2) {
      throw Acme.malformed(
        "A certificate's ID is its authority key identifier and serial, base64url, joined by a dot",
      );
    }
    const keyId = Buffer.from(aki, "base64url").toString("hex");
    const serial = Buffer.from(serialPart, "base64url")
      .toString("hex")
      .replace(/^0+/, "");
    const candidates = await this.prisma.certificate.findMany({
      where: { serial },
      include: { profileVersion: true },
    });
    const certificate = candidates.find((c) => {
      const extension = new x509.X509Certificate(
        new Uint8Array(c.der),
      ).getExtension(x509.AuthorityKeyIdentifierExtension);
      return extension?.keyId?.toLowerCase() === keyId;
    });
    if (!certificate) {
      throw new AcmeProblem("malformed", 404, "No certificate has that ID");
    }
    const { start, end } = renewalWindowOf(
      {
        status: certificate.status,
        notBefore: certificate.notBefore,
        notAfter: certificate.notAfter,
        renewAtDays: certificate.profileVersion?.renewAtDays,
      },
      Date.now(),
    );
    return {
      suggestedWindow: {
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
      },
    };
  }
}
