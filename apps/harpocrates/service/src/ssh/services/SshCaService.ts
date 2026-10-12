import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import { pkiConfig, type PkiConfigType } from "../../config/configuration";
import { KeyService } from "../../keys/services/KeyService";
import {
  type CreateSshCaRequest,
  SSH_DEFAULT_MAX_VALIDITY_HOURS,
  type SshCa,
  type SshCertificateTypeName,
} from "../../model/ssh";
import { spkiFromPem } from "../../pki/x509";
import { SignerService } from "../../signer/services/SignerService";
import { PrismaService } from "../../store/PrismaService";
import type { SshCa as SshCaRow } from "../../store/prisma";
import { toSshCa } from "../converters/SshConverter";

const TYPE_WORDS: Record<SshCertificateTypeName, string> = {
  user: "User",
  host: "Host",
};

/**
 * The SSH CAs (ADR 0035): online Ed25519 keys in the signer, one type
 * each, created by an admin with no ceremony. A rotation is the next
 * generation, created beside the old; a retired one signs nothing more.
 */
@Injectable()
export class SshCaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly signer: SignerService,
    private readonly keys: KeyService,
    private readonly audit: AuditService,
    @Inject(pkiConfig.KEY) private readonly pki: PkiConfigType,
  ) {}

  async list(): Promise<SshCa[]> {
    const rows = await this.prisma.sshCa.findMany({
      // The enum's order: user CAs before host ones.
      orderBy: [{ type: "asc" }, { number: "asc" }, { generation: "desc" }],
    });
    return rows.map((row) => toSshCa(row, this.pki.sshHostPattern));
  }

  async describe(caId: string): Promise<SshCa> {
    return toSshCa(await this.row(caId), this.pki.sshHostPattern);
  }

  async row(caId: string): Promise<SshCaRow> {
    const row = await this.prisma.sshCa.findUnique({ where: { id: caId } });
    if (!row) throw new NotFoundException(`SSH CA with id ${caId} not found`);
    return row;
  }

  /**
   * The CA a certificate of a type comes from: the pinned one, while it
   * is active, else the newest active generation of that type.
   */
  async forIssuance(
    type: SshCertificateTypeName,
    pinned?: string | null,
  ): Promise<SshCaRow> {
    if (pinned) {
      const row = await this.row(pinned);
      if (row.type !== type || row.status !== "active") {
        throw new UnprocessableEntityException(
          `SSH CA ${pinned} does not sign ${type} certificates now`,
        );
      }
      return row;
    }
    const row = await this.prisma.sshCa.findFirst({
      where: { type, status: "active" },
      orderBy: [{ number: "asc" }, { generation: "desc" }],
    });
    if (!row) {
      throw new UnprocessableEntityException(
        `No active SSH ${TYPE_WORDS[type]} CA: create one first`,
      );
    }
    return row;
  }

  /**
   * A new CA, or the next generation of one: its Ed25519 key generated in
   * the signer and registered there to sign its type only.
   */
  async create(
    principal: Principal,
    request: CreateSshCaRequest,
  ): Promise<SshCa> {
    const number = request.number ?? 1;
    const latest = await this.prisma.sshCa.findFirst({
      where: { type: request.type, number },
      orderBy: { generation: "desc" },
    });
    const generation = (latest?.generation ?? 0) + 1;
    const id = `ssh-${request.type}-${number}-g${generation}`;
    const name = `${this.pki.realm} SSH ${TYPE_WORDS[request.type]} CA ${number} - G${generation}`;
    if (await this.prisma.sshCa.findUnique({ where: { id } })) {
      throw new ConflictException(`SSH CA ${id} already exists`);
    }
    const maxValidityHours =
      request.maxValidityHours ?? SSH_DEFAULT_MAX_VALIDITY_HOURS[request.type];
    const key = await this.signer.generateKey("issuer", "Ed25519");
    const registered = await this.signer.registerSshCa({
      id,
      keyId: key.id,
      kind: request.type,
      maxValiditySeconds: maxValidityHours * 3600,
    });
    await this.prisma.$transaction(async (tx) => {
      const recorded = await this.keys.record(tx, {
        spki: spkiFromPem(key.publicKey),
        purpose: "issuer",
        location: "signer",
        signerKeyId: key.id,
      });
      await tx.sshCa.create({
        data: {
          id,
          name,
          type: request.type,
          number,
          generation,
          keyId: recorded.id,
          publicKey: registered.publicKey,
          maxValidityHours,
          krlUrl: `${this.pki.distributionUrl}/krl/${id}.krl`,
        },
      });
      await this.audit.record(
        {
          kind: AuditKind.SshCaCreated,
          principal,
          subjectType: "ssh-ca",
          subjectId: id,
          attributes: {
            name,
            type: request.type,
            maxValidityHours,
            ...(latest ? { succeeds: latest.id } : {}),
          },
        },
        tx,
      );
    });
    return this.describe(id);
  }

  /** It signs nothing more; hosts and clients trust it until its last expires. */
  async retire(principal: Principal, caId: string): Promise<SshCa> {
    const row = await this.row(caId);
    if (row.status === "retired") return this.describe(caId);
    await this.prisma.$transaction(async (tx) => {
      await tx.sshCa.update({
        where: { id: caId },
        data: { status: "retired", retiredAt: new Date() },
      });
      await this.audit.record(
        {
          kind: AuditKind.SshCaRetired,
          principal,
          subjectType: "ssh-ca",
          subjectId: caId,
          attributes: { name: row.name },
        },
        tx,
      );
    });
    return this.describe(caId);
  }
}
