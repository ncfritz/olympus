import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../support/app";
import { accessToken, bearer } from "../support/tokens";

/**
 * The guard in front of every operation (ADR 0018, 0020): the API's
 * access tokens, the pki roles, and a recent sign-in where it is needed.
 * None of these requests reaches a database or the signer.
 */
describe("authentication and roles", () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it("answers 401 without a token or with a bad one", async () => {
    await server().get("/v1/issuers").expect(401);
    await server()
      .get("/v1/issuers")
      .set("Authorization", "Bearer nonsense")
      .expect(401);
    const wrongAudience = await accessToken({
      roles: ["pki-admin"],
      audience: "elsewhere",
    });
    await server()
      .get("/v1/issuers")
      .set("Authorization", `Bearer ${wrongAudience}`)
      .expect(401);
  });

  it("answers 403 without a pki role", async () => {
    await server()
      .get("/v1/issuers")
      .set("Authorization", await bearer(["content"]))
      .expect(403);
  });

  it("keeps pki-admin's operations from pki-operator", async () => {
    const response = await server()
      .post("/v1/signer/seal")
      .set("Authorization", await bearer(["pki-operator"]))
      .expect(403);
    expect(response.body.message).toMatch(/roles/);
  });

  it("asks for a recent sign-in for ceremonies and escrow export", async () => {
    const response = await server()
      .post("/v1/issuers/roots")
      .set("Authorization", await bearer(["pki-admin"], 3600))
      .send({
        number: 1,
        generation: 1,
        exportPassphrase: "a long export passphrase",
      })
      .expect(403);
    expect(response.body.message).toMatch(/recent sign-in/);
  });

  it("validates bodies before anything else", async () => {
    await server()
      .post("/v1/certificates")
      .set("Authorization", await bearer(["pki-operator"]))
      .send({ profileId: "internal-tls", subject: {}, unexpected: true })
      .expect(400);
  });
});
