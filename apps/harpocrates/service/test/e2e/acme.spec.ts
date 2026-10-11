import * as acme from "acme-client";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import * as tls from "tls";
import type { AddressInfo } from "net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { OID } from "../../src/pki/x509";
import { RenewalListener } from "../../src/renewal/services/RenewalListener";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  freePort,
  type Hierarchy,
  startHarness,
  type Harness,
} from "../support/e2e";

type Credential = {
  id: string;
  label: string;
  names: { exact?: string[]; subtrees?: string[] };
  boundAt?: string;
  revokedAt?: string;
  account?: { id: string; status: string; contacts: string[] };
};

type Created = {
  credential: Credential;
  hmacKey: string;
  directoryUrl: string;
};

/**
 * ACME (ADR 0020, ACME; RFC 8555) on the renewal listener, driven by
 * acme-client, a client library, as a host's ACME client would.
 */
describe.skipIf(!E2E_DATABASE_URL)("ACME", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  let port: number;
  let directoryUrl: string;
  /** What the hosts behind the names serve: http-01 answers and tls-alpn-01 certificates. */
  const http01 = new Map<string, string>();
  const alpn = new Map<string, tls.SecureContext>();
  let httpServer: http.Server;
  let alpnServer: tls.Server;
  const server = () => harness.app.getHttpServer();

  /** A request to the renewal listener, trusting the test root. */
  const call = (
    method: string,
    url: string,
    body?: string,
    headers: Record<string, string> = {},
  ): Promise<{
    status: number;
    headers: Record<string, string | string[] | undefined>;
    text: string;
  }> =>
    new Promise((resolve, reject) => {
      const req = https.request(
        url,
        { method, ca: hierarchy.root.certificate, headers },
        (response) => {
          let text = "";
          response.on("data", (chunk: Buffer) => (text += chunk.toString()));
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              text,
            }),
          );
        },
      );
      req.on("error", reject);
      req.end(body);
    });

  const createCredential = async (
    names: Credential["names"],
    label = "a client",
  ): Promise<Created> =>
    (
      await request(server())
        .post("/v1/acme/credentials")
        .set("Authorization", harness.admin)
        .send({ label, names })
        .expect(201)
    ).body as Created;

  const clientFor = async (created?: Created, accountKey?: Buffer) =>
    new acme.Client({
      directoryUrl,
      accountKey: accountKey ?? (await acme.crypto.createPrivateEcdsaKey()),
      externalAccountBinding: created
        ? { kid: created.credential.id, hmacKey: created.hmacKey }
        : undefined,
    });

  beforeAll(async () => {
    port = await freePort();
    const dir = fs.mkdtempSync(path.join("/tmp", "hrp-acme-"));
    // Every name a challenge is for is this host, on these ports.
    httpServer = http.createServer((req, res) => {
      const answer = http01.get(
        req.url?.replace("/.well-known/acme-challenge/", "") ?? "",
      );
      res.statusCode = answer ? 200 : 404;
      res.end(answer ?? "not here");
    });
    await new Promise<void>((resolve) =>
      httpServer.listen(0, "127.0.0.1", resolve),
    );
    alpnServer = tls.createServer({
      ALPNProtocols: ["acme-tls/1"],
      SNICallback: (name, done) => done(null, alpn.get(name)),
    });
    await new Promise<void>((resolve) =>
      alpnServer.listen(0, "127.0.0.1", resolve),
    );
    harness = await startHarness({
      env: {
        RENEWAL_LISTEN_PORT: String(port),
        RENEWAL_TLS_DIR: path.join(dir, "tls"),
        RENEWAL_HOSTNAMES: "localhost",
        ACME_CHALLENGE_RESOLVE: "127.0.0.1",
        ACME_HTTP_PORT: String((httpServer.address() as AddressInfo).port),
        ACME_TLS_ALPN_PORT: String((alpnServer.address() as AddressInfo).port),
      },
    });
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
      {
        purpose: "Service",
        extendedKeyUsages: [OID.clientAuth, OID.serverAuth],
      },
    ]);
    await harness.app.get(RenewalListener).check();
    directoryUrl = `https://localhost:${port}/acme/directory`;
    // acme-client's own HTTP client: trust the test root.
    acme.axios.defaults.httpsAgent = new https.Agent({
      ca: hierarchy.root.certificate,
    });
  });

  afterAll(async () => {
    await harness?.close();
    httpServer?.close();
    alpnServer?.close();
  });

  describe("the directory and nonces", () => {
    it("lists the resources, and says an account needs a binding", async () => {
      const answer = await call("GET", directoryUrl);
      expect(answer.status).toBe(200);
      expect(JSON.parse(answer.text)).toMatchObject({
        newNonce: `https://localhost:${port}/acme/new-nonce`,
        newAccount: `https://localhost:${port}/acme/new-account`,
        meta: { externalAccountRequired: true },
      });
      expect(answer.headers["replay-nonce"]).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(answer.headers["cache-control"]).toBe("no-store");
    });

    it("hands out a nonce with HEAD (200) and GET (204)", async () => {
      const head = await call(
        "HEAD",
        `https://localhost:${port}/acme/new-nonce`,
      );
      const get = await call("GET", `https://localhost:${port}/acme/new-nonce`);
      expect([head.status, get.status]).toEqual([200, 204]);
      expect(head.headers["replay-nonce"]).not.toBe(
        get.headers["replay-nonce"],
      );
    });

    it("answers a request that is not a JWS with a problem and a nonce", async () => {
      const answer = await call(
        "POST",
        `https://localhost:${port}/acme/new-account`,
        JSON.stringify({ hello: "world" }),
        { "content-type": "application/jose+json" },
      );
      expect(answer.status).toBe(400);
      expect(answer.headers["content-type"]).toMatch(
        /^application\/problem\+json/,
      );
      expect(answer.headers["replay-nonce"]).toBeDefined();
      expect(JSON.parse(answer.text)).toMatchObject({
        type: "urn:ietf:params:acme:error:malformed",
        status: 400,
      });
    });

    it("is served on the renewal listener only", async () => {
      await request(server()).get("/acme/directory").expect(404);
    });
  });

  describe("credentials", () => {
    it("are an admin's to make, from DNS names", async () => {
      await request(server())
        .post("/v1/acme/credentials")
        .set("Authorization", harness.operator)
        .send({ label: "x", names: { exact: ["x.internal.ncfritz.net"] } })
        .expect(403);
      for (const names of [
        {},
        { exact: ["*.internal.ncfritz.net"] },
        { subtrees: ["localhost"] },
      ]) {
        await request(server())
          .post("/v1/acme/credentials")
          .set("Authorization", harness.admin)
          .send({ label: "x", names })
          .expect(400);
      }
      const created = await createCredential(
        {
          exact: ["NAS.internal.ncfritz.net."],
          subtrees: ["lab.internal.ncfritz.net"],
        },
        "the NAS",
      );
      expect(created.directoryUrl).toBe(directoryUrl);
      expect(created.hmacKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(created.credential).toMatchObject({
        label: "the NAS",
        names: {
          exact: ["nas.internal.ncfritz.net"],
          subtrees: ["lab.internal.ncfritz.net"],
        },
      });
      const listed = await request(server())
        .get("/v1/acme/credentials")
        .set("Authorization", harness.operator)
        .expect(200);
      expect(JSON.stringify(listed.body)).not.toContain(created.hmacKey);
    });
  });

  describe("accounts", () => {
    it("need an External Account Binding", async () => {
      const client = await clientFor();
      await expect(
        client.createAccount({ termsOfServiceAgreed: true }),
      ).rejects.toThrow(/External Account Binding/);
    });

    it("register once per credential, which binding uses up", async () => {
      const created = await createCredential({
        exact: ["git.internal.ncfritz.net"],
      });
      const accountKey = await acme.crypto.createPrivateEcdsaKey();
      const client = await clientFor(created, accountKey);
      const account = await client.createAccount({
        termsOfServiceAgreed: true,
        contact: ["mailto:neil@example.test"],
      });
      expect(account).toMatchObject({
        status: "valid",
        contact: ["mailto:neil@example.test"],
      });
      const accountUrl = client.getAccountUrl();
      expect(accountUrl).toMatch(
        new RegExp(`^https://localhost:${port}/acme/account/[0-9a-f-]{36}$`),
      );

      // The same key finds the same account.
      const again = await clientFor(created, accountKey);
      await again.createAccount({ termsOfServiceAgreed: true });
      expect(again.getAccountUrl()).toBe(accountUrl);

      // Another key cannot reuse the credential.
      const other = await clientFor(created);
      await expect(
        other.createAccount({ termsOfServiceAgreed: true }),
      ).rejects.toThrow(/unknown, used or revoked/);

      const row = await harness.prisma.acmeEabCredential.findUniqueOrThrow({
        where: { id: created.credential.id },
      });
      expect(row.hmacKey).toBeNull();
      expect(row.boundAt).not.toBeNull();
    });

    it("refuse a binding MACed with another key, or for another account key", async () => {
      const created = await createCredential({
        exact: ["mac.internal.ncfritz.net"],
      });
      const wrongKey = await clientFor({
        ...created,
        hmacKey: Buffer.alloc(32, 1).toString("base64url"),
      });
      await expect(
        wrongKey.createAccount({ termsOfServiceAgreed: true }),
      ).rejects.toThrow(/MAC does not verify/);
      // Still unused: the right key registers.
      const client = await clientFor(created);
      await client.createAccount({ termsOfServiceAgreed: true });
    });

    it("update their contacts, and deactivate themselves", async () => {
      const created = await createCredential({
        exact: ["web.internal.ncfritz.net"],
      });
      const client = await clientFor(created);
      await client.createAccount({ termsOfServiceAgreed: true });
      const updated = await client.updateAccount({
        contact: ["mailto:ops@example.test"],
      });
      expect(updated.contact).toEqual(["mailto:ops@example.test"]);
      await expect(
        client.updateAccount({ contact: ["tel:+15555550100"] }),
      ).rejects.toThrow(/only mailto/);

      const deactivated = await client.updateAccount({ status: "deactivated" });
      expect(deactivated.status).toBe("deactivated");
      await expect(client.updateAccount({})).rejects.toThrow(/deactivated/);
      const kinds = (
        await harness.prisma.auditEvent.findMany({
          where: { subjectType: "acme-account" },
        })
      ).map((e) => e.kind);
      expect(kinds).toEqual(
        expect.arrayContaining([
          "acme-account.created",
          "acme-account.updated",
          "acme-account.deactivated",
        ]),
      );
    });

    it("are revoked with their credential", async () => {
      const created = await createCredential({
        exact: ["old.internal.ncfritz.net"],
      });
      const client = await clientFor(created);
      await client.createAccount({ termsOfServiceAgreed: true });
      await request(server())
        .post(`/v1/acme/credential/${created.credential.id}/revoke`)
        .set("Authorization", harness.operator)
        .expect(403);
      const revoked = await request(server())
        .post(`/v1/acme/credential/${created.credential.id}/revoke`)
        .set("Authorization", harness.admin)
        .expect(200);
      expect(
        (revoked.body as { credential: Credential }).credential,
      ).toMatchObject({
        revokedAt: expect.any(String),
        account: { status: "revoked" },
      });
      await expect(client.updateAccount({})).rejects.toThrow(/revoked/);
      await request(server())
        .post(`/v1/acme/credential/${created.credential.id}/revoke`)
        .set("Authorization", harness.admin)
        .expect(409);
    });
  });

  describe("orders", () => {
    let client: acme.Client;

    /** Serves a challenge as the host would, and says it is ready. */
    const answer = async (
      authorization: acme.Authorization,
      type: "http-01" | "tls-alpn-01",
      serve = true,
    ) => {
      const challenge = authorization.challenges.find((c) => c.type === type)!;
      const keyAuthorization =
        await client.getChallengeKeyAuthorization(challenge);
      if (type === "http-01") {
        http01.set(challenge.token, serve ? keyAuthorization : "wrong");
      } else {
        const [key, cert] = await acme.crypto.createAlpnCertificate(
          authorization,
          keyAuthorization,
        );
        alpn.set(
          authorization.identifier.value,
          tls.createSecureContext({ key, cert }),
        );
      }
      await client.completeChallenge(challenge);
      return challenge;
    };

    beforeAll(async () => {
      const created = await createCredential({
        exact: ["nas.internal.ncfritz.net"],
        subtrees: ["lab.internal.ncfritz.net"],
      });
      client = await clientFor(created);
      await client.createAccount({ termsOfServiceAgreed: true });
    });

    it("are for names the account's policy allows, and nothing else", async () => {
      await expect(
        client.createOrder({
          identifiers: [
            { type: "dns", value: "nas.internal.ncfritz.net" },
            { type: "dns", value: "git.internal.ncfritz.net" },
          ],
        }),
      ).rejects.toThrow(/git.internal.ncfritz.net is not among the names/);
      await expect(
        client.createOrder({
          identifiers: [{ type: "ip", value: "10.0.0.1" }],
        }),
      ).rejects.toThrow(/only dns identifiers/);
      await expect(
        client.createOrder({
          identifiers: [{ type: "dns", value: "*.lab.internal.ncfritz.net" }],
        }),
      ).rejects.toThrow(/wildcards need dns-01/);
      await expect(
        client.createOrder({
          identifiers: [{ type: "dns", value: "nas.internal.ncfritz.net" }],
          notAfter: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      ).rejects.toThrow(/notBefore and notAfter are not taken/);
    });

    it("are ready once every name is proved, by http-01 or tls-alpn-01", async () => {
      const order = await client.createOrder({
        identifiers: [
          { type: "dns", value: "NAS.internal.ncfritz.net" },
          { type: "dns", value: "a.lab.internal.ncfritz.net" },
        ],
      });
      expect(order).toMatchObject({
        status: "pending",
        identifiers: [
          { type: "dns", value: "a.lab.internal.ncfritz.net" },
          { type: "dns", value: "nas.internal.ncfritz.net" },
        ],
      });
      const authorizations = await client.getAuthorizations(order);
      expect(
        authorizations.map((a) => a.challenges.map((c) => c.type)),
      ).toEqual([
        ["http-01", "tls-alpn-01"],
        ["http-01", "tls-alpn-01"],
      ]);
      const [lab, nas] = authorizations;
      await client.waitForValidStatus(await answer(nas, "http-01"));
      await client.waitForValidStatus(await answer(lab, "tls-alpn-01"));
      // The order settles just after its last challenge does.
      await vi.waitFor(
        async () => expect((await client.getOrder(order)).status).toBe("ready"),
        { timeout: 5_000, interval: 100 },
      );
      const kinds = (
        await harness.prisma.auditEvent.findMany({
          where: { subjectType: "acme-order" },
        })
      ).map((e) => e.kind);
      expect(kinds).toEqual(
        expect.arrayContaining(["acme-order.created", "acme-challenge.valid"]),
      );
    });

    it("are invalid when a host does not prove its name, with why", async () => {
      const order = await client.createOrder({
        identifiers: [{ type: "dns", value: "b.lab.internal.ncfritz.net" }],
      });
      const [authorization] = await client.getAuthorizations(order);
      const challenge = await answer(authorization, "http-01", false);
      await expect(client.waitForValidStatus(challenge)).rejects.toThrow(
        /served something other than the key authorization/,
      );
      const failed = await client.getOrder(order);
      expect(failed).toMatchObject({
        status: "invalid",
        error: { type: "urn:ietf:params:acme:error:incorrectResponse" },
      });
    }, 30_000);

    it("are invalid when an authorization is deactivated", async () => {
      const order = await client.createOrder({
        identifiers: [{ type: "dns", value: "c.lab.internal.ncfritz.net" }],
      });
      const [authorization] = await client.getAuthorizations(order);
      const deactivated = await client.deactivateAuthorization(authorization);
      expect(deactivated.status).toBe("deactivated");
      expect((await client.getOrder(order)).status).toBe("invalid");
    });

    it("are their account's alone", async () => {
      const order = await client.createOrder({
        identifiers: [{ type: "dns", value: "d.lab.internal.ncfritz.net" }],
      });
      const stranger = await clientFor(
        await createCredential({ subtrees: ["lab.internal.ncfritz.net"] }),
      );
      await stranger.createAccount({ termsOfServiceAgreed: true });
      await expect(stranger.getOrder(order)).rejects.toThrow(
        /for this account/,
      );
    });
  });
});
