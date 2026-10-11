import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../store/PrismaService";

/** How long a nonce is good for: a client uses one within seconds. */
const NONCE_MS = 15 * 60_000;

/**
 * Replay-Nonce (RFC 8555 §6.5): one on every ACME response, each good for
 * one request within 15 minutes. A table, so any instance can check
 * another's, and a restart forgets none.
 */
@Injectable()
export class AcmeNonceService {
  private issued = 0;

  constructor(private readonly prisma: PrismaService) {}

  async issue(): Promise<string> {
    const value = randomBytes(16).toString("base64url");
    const now = Date.now();
    await this.prisma.acmeNonce.create({
      data: { value, expiresAt: new Date(now + NONCE_MS) },
    });
    // Now and then, the ones never used.
    if (++this.issued % 100 === 1) {
      await this.prisma.acmeNonce.deleteMany({
        where: { expiresAt: { lt: new Date(now) } },
      });
    }
    return value;
  }

  /** Uses a nonce up: true when it was ours, unused and unexpired. */
  async consume(value: string): Promise<boolean> {
    const used = await this.prisma.acmeNonce.deleteMany({
      where: { value, expiresAt: { gt: new Date() } },
    });
    return used.count === 1;
  }
}
