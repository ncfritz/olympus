import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";

type ExpiresIn = JwtSignOptions["expiresIn"];

const ACCESS_TOKEN_TTL: ExpiresIn = "1h";
const REFRESH_TOKEN_TTL: ExpiresIn = "30d";

interface TokenPayload {
  email: string;
  type: "access" | "refresh";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Issues and verifies this app's own JWTs (distinct from the OIDC provider's
 * tokens, which are only ever used transiently during login). Access tokens
 * are short-lived; refresh tokens are long-lived and only ever exchanged for
 * a new access token via /auth/refresh, never accepted directly by the API.
 */
@Injectable()
export class AuthTokenService {
  constructor(private readonly jwt: JwtService) {}

  issueTokenPair(email: string): TokenPair {
    return {
      accessToken: this.sign(email, "access", ACCESS_TOKEN_TTL),
      refreshToken: this.sign(email, "refresh", REFRESH_TOKEN_TTL),
    };
  }

  issueAccessToken(email: string): string {
    return this.sign(email, "access", ACCESS_TOKEN_TTL);
  }

  /** Returns the verified email. Throws UnauthorizedException if invalid, expired, or the wrong token type. */
  verifyAccessToken(token: string): string {
    return this.verify(token, "access");
  }

  /** Returns the verified email. Throws UnauthorizedException if invalid, expired, or the wrong token type. */
  verifyRefreshToken(token: string): string {
    return this.verify(token, "refresh");
  }

  private sign(
    email: string,
    type: TokenPayload["type"],
    expiresIn: ExpiresIn,
  ): string {
    return this.jwt.sign({ email, type } satisfies TokenPayload, { expiresIn });
  }

  private verify(token: string, expectedType: TokenPayload["type"]): string {
    let payload: TokenPayload;
    try {
      payload = this.jwt.verify<TokenPayload>(token);
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired token", {
        cause: error,
      });
    }

    if (payload.type !== expectedType) {
      throw new UnauthorizedException(`Expected a ${expectedType} token`);
    }
    return payload.email;
  }
}
