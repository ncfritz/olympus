import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../store/PrismaService";
import type { Principal } from "../principal";

export type OlympusUserRow = {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Who `user:<id>` is. An access token names its user by ID alone, so that
 * is what the audit log and every other record keep; the Olympus API
 * describes them (their email) when the console asks who is signed in,
 * and that is remembered here.
 */
@Injectable()
export class OlympusUserService {
  private readonly logger = new Logger(OlympusUserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Remembers a user's email, for the records that name them by ID.
   * Never fails the request it comes from: a miss is logged, and the
   * user's next sign-in tries again.
   */
  async remember(principal: Principal, email: string): Promise<void> {
    const id = /^user:(.+)$/.exec(principal.id)?.[1];
    if (!id || !email) return;
    try {
      await this.prisma.olympusUser.upsert({
        where: { id },
        create: { id, email },
        update: { email },
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Could not remember who ${principal.id} is: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Every user seen, by email. */
  list(): Promise<OlympusUserRow[]> {
    return this.prisma.olympusUser.findMany({ orderBy: { email: "asc" } });
  }
}
