import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import * as jose from "jose";
import { createSecretKey } from "node:crypto";
import * as speakeasy from "speakeasy";

type GraphQlGetContentAuthResponse = {
  dionysus_content_auth_by_pk: {
    key: string;
    key_id: string;
    createdTime: string;
  } | null;
};

type FetchJwtQueryInput = Record<string, never>;

type FetchJwtQueryResponse = {
  dionysus_content_auth_by_pk: {
    key: string;
    key_id: string;
    creationTime: string;
  };
};

/**
 * Content auth ("black curtain"): the keys in Hasura, the token issued by
 * VerifyAuthCode and the curtain applied to requests without one. Tokens are
 * the value of the CONTENT_AUTH_COOKIE cookie (see contentAuthToken).
 */
@Injectable()
export class ContentAuthService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** The content auth key of `type` ("jwt.key", "bc.key"). */
  async getKey(type: string): Promise<string> {
    const fetchKeyRequest = gql`
      query FetchContentAuthKey($keyId: String!) {
        dionysus_content_auth_by_pk(key_id: $keyId) {
          key
          key_id
          createdTime
        }
      }
    `;

    const fetchKeyResponse =
      await this.graphQLClient.request<GraphQlGetContentAuthResponse>(
        fetchKeyRequest,
        { keyId: type },
      );

    if (!fetchKeyResponse.dionysus_content_auth_by_pk) {
      throw new InternalServerErrorException(
        `Content auth key "${type}" is not configured`,
      );
    }

    return fetchKeyResponse.dionysus_content_auth_by_pk.key;
  }

  /**
   * True when `token` is a valid content auth token (issued by
   * VerifyAuthCode). Otherwise false, or 401 unless `silent`.
   */
  async authenticate(
    token: string | undefined,
    silent: boolean = false,
  ): Promise<boolean> {
    if (!token) {
      if (!silent) {
        throw new UnauthorizedException();
      }
      return false;
    }

    const signingKey = createSecretKey(await this.getKey("jwt.key"), "utf-8");
    const options: jose.JWTVerifyOptions = {
      algorithms: ["HS256"],
      issuer: "ncfritz.dionysus.content",
      audience: "test",
    };

    try {
      await jose.jwtVerify(token, signingKey, options);
      return true;
    } catch (e) {
      if (!silent) {
        throw new UnauthorizedException(e);
      }
    }

    return false;
  }

  /**
   * CheckAuthorization: true when `token` was issued in the last 30 minutes.
   * Returns false without a lookup when there is no token.
   */
  async checkAuthorization(token: string | undefined): Promise<boolean> {
    if (!token) {
      return false;
    }

    const fetchJwtKeyRequest = gql`
      query CheckAuthorization {
        dionysus_content_auth_by_pk(key_id: "jwt.key") {
          key
          key_id
          createdTime
        }
      }
    `;

    const fetchJwtKeyResponse = await this.graphQLClient.request<
      FetchJwtQueryResponse,
      FetchJwtQueryInput
    >(fetchJwtKeyRequest);
    const jwtKey = new TextEncoder().encode(
      fetchJwtKeyResponse.dionysus_content_auth_by_pk.key,
    );

    try {
      await jose.jwtVerify(token, jwtKey, {
        issuer: "ncfritz.dionysus.content",
        maxTokenAge: "30m",
      });
    } catch {
      return false;
    }

    return true;
  }

  /**
   * Verifies a TOTP code and returns a new 15-minute content auth token.
   * @throws UnauthorizedException when the code is not valid
   */
  async verifyCode(otp: string): Promise<string> {
    const otpKey = await this.getKey("bc.key");
    const verified = speakeasy.totp.verify({
      secret: otpKey,
      encoding: "base32",
      token: otp,
    });

    if (!verified) {
      throw new UnauthorizedException();
    }
    const jwtKey = await this.getKey("jwt.key");
    const alg = "HS256";
    return await new jose.SignJWT({ "urn:example:claim": true })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setIssuer("ncfritz.dionysus.content")
      .setAudience("test")
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(jwtKey));
  }
}
