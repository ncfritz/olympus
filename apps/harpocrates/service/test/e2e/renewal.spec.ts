import { createPrivateKey, X509Certificate } from "crypto";
import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// The client's own source, not the package: the SDK, which the client is
// built on, is generated from this service's document, so a dependency
// on the client would be a cycle.
import { CertificateRenewer } from "../../../../../packages/client/src/renewal";
import { createTlsAgent } from "../../../../../packages/client/src/tls";
import { OID } from "../../src/pki/x509";
import { RenewalListener } from "../../src/renewal/services/RenewalListener";
import {
  buildHierarchy,
  E2E_DATABASE_URL,
  freePort,
  type Hierarchy,
  makeCsr,
  startHarness,
  type Harness,
} from "../support/e2e";

type Certificate = {
  id: string;
  serial: string;
  subject: string;
  profileId: string;
  issuerId: string;
  certificate: string;
  chain: string[];
};

const DAY = 24 * 60 * 60 * 1000;

/** PKCS#8 PEM of a WebCrypto key pair's private half. */
const keyPem = async (keys: CryptoKeyPair): Promise<string> =>
  createPrivateKey({
    key: Buffer.from(await crypto.subtle.exportKey("pkcs8", keys.privateKey)),
    format: "der",
    type: "pkcs8",
  })
    .export({ format: "pem", type: "pkcs8" })
    .toString();

/**
 * Renewal over mutual TLS (ADR 0020, Renewal and delivery; sign-off C9):
 * the listener on its own port with Harpocrates's own certificate from the
 * TLS CA, a caller's certificate as its only credential, and the routes of
 * each listener kept apart.
 */
describe.skipIf(!E2E_DATABASE_URL)("renewal over mutual TLS", () => {
  let harness: Harness;
  let hierarchy: Hierarchy;
  let port: number;
  const server = () => harness.app.getHttpServer();

  /** POST /v1/renew on the renewal listener, as `client` (or nobody). */
  const renew = (
    body: Record<string, unknown>,
    client?: { cert: string; key: string },
  ): Promise<{ status: number; body: Record<string, unknown> }> =>
    new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = https.request(
        {
          host: "localhost",
          port,
          path: "/v1/renew",
          method: "POST",
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
          ca: hierarchy.root.certificate,
          ...client,
        },
        (response) => {
          let text = "";
          response.on("data", (chunk: Buffer) => (text += chunk.toString()));
          response.on("end", () =>
            resolve({
              status: response.statusCode ?? 0,
              body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
            }),
          );
        },
      );
      req.on("error", reject);
      req.end(payload);
    });

  /** A service certificate for `name`, from a CSR, and its key. */
  const serviceCertificate = async (name: string) => {
    const { csr, keys } = await makeCsr(name);
    const created = await request(server())
      .post("/v1/certificates")
      .set("Authorization", harness.operator)
      .send({ profileId: "service", subject: { commonName: name }, csr })
      .expect(201);
    const certificate = (created.body as { certificate: Certificate })
      .certificate;
    return { certificate, key: await keyPem(keys), keys };
  };

  beforeAll(async () => {
    port = await freePort();
    const dir = fs.mkdtempSync(path.join("/tmp", "hrp-renewal-"));
    harness = await startHarness({
      env: {
        RENEWAL_LISTEN_PORT: String(port),
        RENEWAL_TLS_DIR: path.join(dir, "tls"),
        RENEWAL_HOSTNAMES: "localhost",
      },
    });
    hierarchy = await buildHierarchy(harness, [
      { purpose: "TLS", extendedKeyUsages: [OID.serverAuth, OID.clientAuth] },
      {
        purpose: "Service",
        extendedKeyUsages: [OID.clientAuth, OID.serverAuth],
      },
    ]);
    // The listener waits for a TLS CA; it now has one.
    await harness.app.get(RenewalListener).check();
  });

  afterAll(async () => {
    await harness?.close();
  });

  it("serves its own certificate, issued from the TLS CA", async () => {
    const served = await new Promise<X509Certificate>((resolve, reject) => {
      const req = https.request(
        { host: "localhost", port, path: "/", ca: hierarchy.root.certificate },
        (response) => {
          const socket = response.socket as import("tls").TLSSocket;
          resolve(new X509Certificate(socket.getPeerCertificate().raw));
          response.resume();
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(served.subject).toContain("CN=localhost");
    expect(served.issuer).toContain("TLS Issuing CA 1");
    expect(served.subjectAltName).toBe("DNS:localhost");
  });

  it("renews the presented certificate with a new key", async () => {
    const { certificate, key } = await serviceCertificate("billing");
    const { csr } = await makeCsr("billing");
    const renewed = await renew(
      { csr },
      { cert: certificate.certificate, key },
    );
    expect(renewed.status).toBe(201);
    const renewal = renewed.body.certificate as Certificate;
    expect(renewal).toMatchObject({
      subject: certificate.subject,
      profileId: "service",
      issuerId: certificate.issuerId,
    });
    expect(renewal.serial).not.toBe(certificate.serial);
    const event = await harness.prisma.auditEvent.findFirstOrThrow({
      where: { kind: "certificate.renewed", subjectId: renewal.id },
    });
    expect(event).toMatchObject({
      principal: `certificate:${certificate.serial}`,
      surface: "renewal",
    });

    // Renewed once: the old one renews no more.
    const again = await renew({}, { cert: certificate.certificate, key });
    expect(again.status).toBe(403);
    expect(again.body.message).toMatch(/already renewed/);
  });

  it("keeps a young key when there is no CSR", async () => {
    const { certificate, key, keys } = await serviceCertificate("search");
    const renewed = await renew({}, { cert: certificate.certificate, key });
    expect(renewed.status).toBe(201);
    const renewal = renewed.body.certificate as Certificate;
    const spki = Buffer.from(
      await crypto.subtle.exportKey("spki", keys.publicKey),
    );
    expect(
      new X509Certificate(renewal.certificate).publicKey.export({
        type: "spki",
        format: "der",
      }),
    ).toEqual(spki);
  });

  it("answers 401 without a certificate, or for one it did not issue or has revoked", async () => {
    expect((await renew({})).status).toBe(401);

    const { certificate, key } = await serviceCertificate("mail");
    await request(server())
      .post(`/v1/certificate/${certificate.id}/revoke`)
      .set("Authorization", harness.operator)
      .send({ reason: "superseded" })
      .expect(200);
    const revoked = await renew({}, { cert: certificate.certificate, key });
    expect(revoked.status).toBe(401);
    expect(revoked.body.message).toMatch(/revoked/);

    // Another CA's certificate: the TLS listener's own, which Harpocrates
    // issued, would pass, so a self-made one stands in for a stranger's.
    const stranger = await makeCsr("stranger");
    const x509 = await import("@peculiar/x509");
    const selfSigned = await x509.X509CertificateGenerator.createSelfSigned({
      serialNumber: certificate.serial,
      name: "CN=stranger",
      keys: stranger.keys,
      signingAlgorithm: { name: "ECDSA", hash: "SHA-256" },
    });
    const unknown = await renew(
      {},
      { cert: selfSigned.toString("pem"), key: await keyPem(stranger.keys) },
    );
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toMatch(/not one Harpocrates issued/);
  });

  it("answers 403 for another certificate or another subject", async () => {
    const one = await serviceCertificate("calendar");
    const other = await serviceCertificate("notifications");
    const asOther = await renew(
      { certificateId: other.certificate.id },
      { cert: one.certificate.certificate, key: one.key },
    );
    expect(asOther.status).toBe(403);
    const { csr } = await makeCsr("notifications");
    const otherSubject = await renew(
      { csr },
      { cert: one.certificate.certificate, key: one.key },
    );
    expect(otherSubject.status).toBe(403);
    expect(otherSubject.body.message).toMatch(/CSR asks for/);
  });

  it("is what a service's renewer and agent use, with no restart", async () => {
    // The service's files, as it is configured with them.
    const { certificate, key } = await serviceCertificate("weather-relay");
    const dir = fs.mkdtempSync(path.join("/tmp", "hrp-agent-"));
    const ca = path.join(dir, "root.crt");
    fs.writeFileSync(ca, hierarchy.root.certificate);
    const tls = {
      certificate: path.join(dir, "client.crt"),
      key: path.join(dir, "client.key"),
      ca,
      renewal: { url: `https://localhost:${port}`, ca },
    };
    fs.writeFileSync(
      tls.certificate,
      [certificate.certificate, ...certificate.chain].join(""),
    );
    fs.writeFileSync(tls.key, key);
    const agent = createTlsAgent(tls, 60_000);
    const quiet = { log: () => {}, warn: () => {} };
    try {
      const renewer = new CertificateRenewer(tls, quiet);
      expect(await renewer.check(new Date())).toBe("not-due");
      expect(await renewer.check(new Date(Date.now() + 365 * DAY))).toBe(
        "renewed",
      );
      const renewed = new X509Certificate(fs.readFileSync(tls.certificate));
      expect(renewed.serialNumber.toLowerCase().replace(/^0+/, "")).not.toBe(
        certificate.serial,
      );
      expect(renewed.subject).toBe(
        new X509Certificate(certificate.certificate).subject,
      );
      // The agent's next connection presents the renewal.
      expect(agent.reload()).toBe(true);
    } finally {
      agent.destroy();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps each listener's routes to itself", async () => {
    await request(server())
      .post("/v1/renew")
      .set("Authorization", harness.admin)
      .send({})
      .expect(404);
    const { certificate, key } = await serviceCertificate("metadata");
    const management = await new Promise<number>((resolve, reject) => {
      const req = https.request(
        {
          host: "localhost",
          port,
          path: "/v1/issuers",
          ca: hierarchy.root.certificate,
          cert: certificate.certificate,
          key,
        },
        (response) => {
          resolve(response.statusCode ?? 0);
          response.resume();
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(management).toBe(404);
  });
});
