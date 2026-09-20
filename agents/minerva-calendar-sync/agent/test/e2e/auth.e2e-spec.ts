import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/AppModule";
import { AuthTokenService } from "../../src/auth/services/AuthTokenService";
import { E2E_ALLOWED_EMAIL, issueE2eAccessToken } from "./auth-fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// The full OIDC login/callback dance needs a live identity provider to talk
// to (discovery is a real network call) and is out of scope for e2e — that
// handshake is the provider's responsibility, not ours to re-test. These
// tests cover everything downstream of it: token issuance/verification,
// the allowlist gate, and the guard's access control.
describe("Auth (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /auth/me returns the authenticated user", async () => {
    const authHeader = `Bearer ${issueE2eAccessToken(app)}`;

    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", authHeader)
      .expect(200);
    expect(res.body).toEqual({ email: E2E_ALLOWED_EMAIL });
  });

  it("rejects a valid token for an email no longer on the allowlist", async () => {
    const authHeader = `Bearer ${issueE2eAccessToken(app, "not-allowed@example.com")}`;

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", authHeader)
      .expect(403);
  });

  it("rejects a malformed token", async () => {
    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
  });

  it("POST /auth/refresh exchanges a refresh token for a new access token", async () => {
    const { refreshToken } = app
      .get(AuthTokenService)
      .issueTokenPair(E2E_ALLOWED_EMAIL);

    const res = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(200);
    expect(typeof res.body.accessToken).toBe("string");

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it("POST /auth/refresh rejects an access token used as a refresh token", async () => {
    const accessToken = issueE2eAccessToken(app);
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: accessToken })
      .expect(401);
  });

  it("POST /auth/logout clears the access-token cookie", async () => {
    const res = await request(app.getHttpServer())
      .post("/auth/logout")
      .expect(204);
    const setCookie = res.headers["set-cookie"];
    expect(setCookie?.[0]).toMatch(/minerva_access_token=;/);
  });
});
