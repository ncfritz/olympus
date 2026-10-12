import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import moment from "moment";
import type { Principal } from "../../auth/principal";
import {
  SSH_RENEWAL_NAMESPACE,
  type SshCertificate,
  type SshRenewalChallenge,
} from "../../model/ssh";
import { verifySshSignature } from "../../pki/ssh";
import { ProfileService } from "../../profiles/services/ProfileService";
import { PrismaService } from "../../store/PrismaService";
import { SshCertificateService } from "./SshCertificateService";

const HOUR = 3600 * 1000;

/** How long a host has to sign its challenge. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** A certificate's type and key, as its file holds them: what is compared. */
const essence = (certificate: string) =>
  certificate.trim().split(/\s+/).slice(0, 2).join(" ");

/**
 * Hosts renewing their own SSH certificates (ADR 0035): the host shows its
 * current certificate, gets a challenge, signs it with its host key
 * (`ssh-keygen -Y sign`), and gets the next certificate, with the same
 * principals under the same version. No credential but the host key.
 */
@Injectable()
export class SshHostRenewalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileService,
    private readonly certificates: SshCertificateService,
  ) {}

  /** A challenge for a current host certificate, and whether it is due. */
  async challenge(certificate: string): Promise<SshRenewalChallenge> {
    const current = await this.renewable(essence(certificate));
    const version = await this.profiles.version(current.profileVersionId);
    const renewAt = new Date(
      current.validAfter.getTime() + version.ssh!.renewAtHours * HOUR,
    );
    const challenge = await this.prisma.sshRenewalChallenge.create({
      data: {
        sshCertificateId: current.id,
        nonce: randomBytes(32).toString("base64url"),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
      },
    });
    return {
      id: challenge.id,
      nonce: challenge.nonce,
      namespace: SSH_RENEWAL_NAMESPACE,
      due: renewAt.getTime() <= Date.now(),
      renewAt: moment(renewAt),
      expiresAt: moment(challenge.expiresAt),
    };
  }

  /**
   * The next certificate, once the challenge's signature verifies by the
   * certificate's own key: once due, the challenge used once and in time.
   */
  async renew(challengeId: string, signature: string): Promise<SshCertificate> {
    const now = new Date();
    // Used at once, whatever follows: a challenge is never tried twice.
    const used = await this.prisma.sshRenewalChallenge.updateMany({
      where: { id: challengeId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (used.count !== 1) {
      throw new ForbiddenException(
        "The challenge is unknown, used or lapsed: ask for another",
      );
    }
    const challenge = await this.prisma.sshRenewalChallenge.findUniqueOrThrow({
      where: { id: challengeId },
      include: { sshCertificate: { include: { principals: true } } },
    });
    const current = await this.renewable(
      essence(challenge.sshCertificate.certificate),
    );
    let signer;
    try {
      signer = verifySshSignature(
        signature,
        Buffer.from(challenge.nonce, "utf8"),
        SSH_RENEWAL_NAMESPACE,
      );
    } catch (error: unknown) {
      throw new ForbiddenException(
        `The signature is refused: ${(error as Error).message}`,
      );
    }
    if (signer.fingerprint !== current.fingerprint) {
      throw new ForbiddenException(
        "The challenge was not signed by the certificate's key",
      );
    }
    const profile = await this.profiles.version(current.profileVersionId);
    const renewAt =
      current.validAfter.getTime() + profile.ssh!.renewAtHours * HOUR;
    if (renewAt > now.getTime()) {
      throw new ConflictException(
        `The certificate is not due until ${new Date(renewAt).toISOString()}`,
      );
    }
    const principals = [...challenge.sshCertificate.principals]
      .sort((a, b) => a.position - b.position)
      .map((p) => p.principal);
    const host: Principal = {
      id: `ssh-host:${principals[0]}`,
      roles: [],
      authTime: 0,
      surface: "renewal",
    };
    return this.certificates.issue({
      profile,
      type: "host",
      key: signer,
      principals,
      issuedBy: host,
      renews: current.id,
    });
  }

  /** A host certificate that may be renewed: current, unrevoked, not yet renewed. */
  private async renewable(certificate: string) {
    const rows = await this.prisma.sshCertificate.findMany({
      where: { type: "host", certificate: { startsWith: certificate } },
      include: { renewedBy: { select: { id: true } } },
    });
    const row = rows.find((r) => essence(r.certificate) === certificate);
    if (!row) {
      throw new NotFoundException("Harpocrates did not issue this certificate");
    }
    if (row.status === "revoked") {
      throw new ForbiddenException(
        "The certificate is revoked: an admin issues the host a new one",
      );
    }
    if (row.validBefore <= new Date()) {
      throw new UnprocessableEntityException(
        "The certificate has expired: an admin issues the host a new one",
      );
    }
    if (row.renewedBy) {
      throw new ConflictException(
        "The certificate has been renewed already: renew the newest",
      );
    }
    return row;
  }
}
