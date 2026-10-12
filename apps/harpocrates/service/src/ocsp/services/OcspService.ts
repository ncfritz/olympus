import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ocspRefreshFailures } from "../../metrics/pkiMetrics";
import { OcspResponderService } from "./OcspResponderService";
import { type OcspRefresh, OcspResponseService } from "./OcspResponseService";

export type OcspRun = {
  /** Online CAs' new responders, by CA. */
  responders: { issuerId: string; serial: string }[];
  /** How many responses each CA had signed. */
  responses: OcspRefresh[];
  /** Superseded responders whose keys were destroyed. */
  retired: string[];
  failed: { issuerId: string; reason: string; message: string }[];
};

const reasonOf = (error: unknown) =>
  error instanceof ServiceUnavailableException
    ? "sealed"
    : error instanceof UnprocessableEntityException
      ? "refused"
      : "error";

const messageOf = (error: unknown) =>
  error instanceof HttpException || error instanceof Error
    ? error.message
    : String(error);

/**
 * One OCSP pass (ADR 0036), run by the list scheduler after its lists:
 * online CAs' responders issued or renewed, every CA's responses signed
 * where they need it, and expired responders' keys destroyed. A sealed
 * signer ends the pass; the next one tries again.
 */
@Injectable()
export class OcspService {
  private readonly logger = new Logger(OcspService.name);

  constructor(
    private readonly responders: OcspResponderService,
    private readonly responses: OcspResponseService,
  ) {}

  async run(now = new Date()): Promise<OcspRun> {
    const result: OcspRun = {
      responders: [],
      responses: [],
      retired: [],
      failed: [],
    };
    const fail = (issuerId: string, error: unknown): boolean => {
      const reason = reasonOf(error);
      result.failed.push({ issuerId, reason, message: messageOf(error) });
      ocspRefreshFailures.inc({ issuer: issuerId, reason });
      if (reason !== "sealed") {
        this.logger.error(`OCSP for ${issuerId} failed: ${messageOf(error)}`);
      }
      // Every other CA would fail the same way.
      return reason === "sealed";
    };

    for (const issuer of await this.responders.due(now)) {
      try {
        const responder = await this.responders.issueOnline(issuer);
        result.responders.push({
          issuerId: issuer.id,
          serial: responder.serial,
        });
      } catch (error: unknown) {
        if (fail(issuer.id, error)) return result;
      }
    }
    for (const issuerId of await this.responses.issuersWithResponders(now)) {
      try {
        const refreshed = await this.responses.refresh(issuerId, now);
        if (refreshed.signed) result.responses.push(refreshed);
      } catch (error: unknown) {
        if (fail(issuerId, error)) return result;
      }
    }
    try {
      result.retired = await this.responders.retireExpired(now);
    } catch (error: unknown) {
      fail("none", error);
    }
    return result;
  }
}
