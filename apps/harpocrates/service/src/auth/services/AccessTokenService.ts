import { Inject, Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as jose from "jose";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { PkiRole, type Principal } from "../principal";

const PKI_ROLES = new Set<string>(Object.values(PkiRole));

/**
 * Verifies the API's access tokens (ADR 0018) against its published keys:
 * ES256 only, the configured audience, the claims the API issues. The
 * service issues no tokens and never touches the auth tables (ADR 0020).
 */
@Injectable()
export class AccessTokenService {
  private readonly logger = new Logger(AccessTokenService.name);
  private loaded?: jose.JWTVerifyGetKey;

  constructor(@Inject(authConfig.KEY) private readonly auth: AuthConfigType) {}

  /** The API's keys, fetched (and cached by jose) or read on first use. */
  private get keys(): jose.JWTVerifyGetKey {
    this.loaded ??= this.auth.jwksUrl
      ? jose.createRemoteJWKSet(new URL(this.auth.jwksUrl))
      : jose.createLocalJWKSet(
          JSON.parse(
            fs.readFileSync(this.auth.jwksFile ?? "", "utf8"),
          ) as jose.JSONWebKeySet,
        );
    return this.loaded;
  }

  /** The principal a token stands for, or undefined (and why, logged). */
  async verify(token: string): Promise<Principal | undefined> {
    try {
      const { payload } = await jose.jwtVerify(token, this.keys, {
        algorithms: ["ES256"],
        audience: this.auth.audience,
      });
      const roles = payload.roles;
      const authTime = payload.auth_time;
      if (
        typeof payload.sub !== "string" ||
        typeof authTime !== "number" ||
        !Array.isArray(roles)
      ) {
        this.logger.warn("Refused a token: claims are not the API's shape");
        return undefined;
      }
      return {
        id: `user:${payload.sub}`,
        roles: roles.filter(
          (role): role is PkiRole =>
            typeof role === "string" && PKI_ROLES.has(role),
        ),
        authTime,
        surface: "api",
      };
    } catch (error: unknown) {
      const code =
        error instanceof jose.errors.JOSEError ? error.code : "invalid token";
      this.logger.warn(`Refused a token: ${code}`);
      return undefined;
    }
  }
}
