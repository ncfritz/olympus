import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuditKind } from "../../audit/auditKinds";
import { AuditService } from "../../audit/services/AuditService";
import type { Principal } from "../../auth/principal";
import type { SignerStatus } from "../../model/signer";
import { SignerService } from "./SignerService";

/** The signer's seal, as the console sees it: status, seal, unseal. */
@Injectable()
export class SealService {
  constructor(
    private readonly signer: SignerService,
    private readonly audit: AuditService,
  ) {}

  async status(): Promise<SignerStatus> {
    const status = await this.signer.status();
    return {
      initialised: status.initialised,
      sealed: status.sealed,
      reason: status.reason ?? undefined,
      ceremonyId: status.ceremony?.id,
    };
  }

  /**
   * Initialises an empty signer (ADR 0032, bootstrap): the recovery
   * passphrase is set and the unseal key returned, once. It is never
   * logged or recorded; the audit log says only that it happened.
   */
  async initialise(principal: Principal, passphrase: string): Promise<string> {
    const unsealKey = await this.signer.initialise(passphrase);
    await this.audit.record({ kind: AuditKind.SignerInitialised, principal });
    return unsealKey;
  }

  async seal(principal: Principal): Promise<void> {
    await this.signer.seal();
    await this.audit.record({ kind: AuditKind.SignerSealed, principal });
  }

  async unseal(principal: Principal, passphrase: string): Promise<void> {
    try {
      await this.signer.unseal(passphrase);
    } catch (error: unknown) {
      if (error instanceof ForbiddenException) {
        await this.audit.record({
          kind: AuditKind.RequestRefused,
          principal,
          reason: "wrong recovery passphrase",
          attributes: { operation: "unseal" },
        });
      }
      throw error;
    }
    await this.audit.record({ kind: AuditKind.SignerUnsealed, principal });
  }
}
