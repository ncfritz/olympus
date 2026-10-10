import type { TokenCheck } from "@ncfritz/olympus-nest";
import { Inject, Injectable, Logger } from "@nestjs/common";
import * as fs from "fs";
import * as jose from "jose";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import { PkiRole, type Principal } from "../principal";

const PKI_ROLES = new Set<string>(Object.values(PkiRole));

/** jose's codes for not getting the keys, as opposed to a token that fails with them. */
const TRANSIENT = new Set([
  "ERR_JWKS_TIMEOUT",
  "ERR_JWKS_INVALID",
  "ERR_JOSE_GENERIC",
]);

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
    const checked = await this.check(token);
    return "claims" in checked ? checked.claims : undefined;
  }

  /**
   * The principal a token stands for, or why not, and whether that is for
   * now (the API's keys could not be had) or for good: a console session
   * is refreshed only for a token that is no good, never for keys that
   * could not be fetched (ADR 0029).
   */
  async check(token: string): Promise<TokenCheck<Principal>> {
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
        return {
          reason: "claims are not the shape Olympus issues",
          transient: false,
        };
      }
      return {
        claims: {
          id: `user:${payload.sub}`,
          roles: roles.filter(
            (role): role is PkiRole =>
              typeof role === "string" && PKI_ROLES.has(role),
          ),
          authTime,
          surface: "api",
        },
      };
    } catch (error: unknown) {
      if (error instanceof jose.errors.JOSEError) {
        this.logger.warn(`Refused a token: ${error.code}`);
        return { reason: error.code, transient: TRANSIENT.has(error.code) };
      }
      // Not jose's own: fetching the keys failed (a refused connection, a
      // name that does not resolve).
      this.logger.warn("Refused a token: the keys could not be fetched");
      return { reason: "the keys could not be fetched", transient: true };
    }
  }
}
