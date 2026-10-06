import { createClientCertificateListener } from "@ncfritz/olympus-nest";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as https from "https";
import type { AddressInfo } from "net";
import { join, resolve } from "path";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/AppModule";
import type { AuthenticatedRequest } from "../../src/auth/authUser";
import { configureApp } from "../../src/configureApp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * The management API on the services listener, with the throwaway
 * certificates of scripts/dev-ca.sh: only the Olympus API's certificate,
 * from the service issuer, gets in (ADR 0028).
 */
const root = resolve(__dirname, "../../../../..");
const certs = join(root, "infra/dev-ca/certs");
const ISSUER = "ncfritz.net Dev Service Issuing CA 1 - G1";

const ensureDevCa = () => {
  if (!fs.existsSync(join(certs, "api.crt"))) {
    execFileSync("bash", [join(root, "scripts/dev-ca.sh")], {
      stdio: "ignore",
    });
  }
};
const hasAgentCertificates = () =>
  fs.existsSync(join(certs, "minerva-calendar-sync.crt")) &&
  fs.existsSync(join(certs, "agents/olympus-api.crt"));

ensureDevCa();

// A dev CA from before these certificates existed: `scripts/dev-ca.sh`
// adds them, and keeps everything else.
describe.skipIf(!hasAgentCertificates())("Services listener (e2e)", () => {
  let app: INestApplication;
  let server: https.Server;
  let port: number;
  const saved = { ...process.env };

  beforeAll(async () => {
    Object.assign(process.env, {
      TLS_CERT: join(certs, "minerva-calendar-sync.crt"),
      TLS_KEY: join(certs, "minerva-calendar-sync.key"),
      TLS_CA_SERVICES: join(certs, "services-ca.crt"),
      AUTH_SERVICES_ISSUER: ISSUER,
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    const revocationLists = fs
      .readdirSync(certs)
      .filter((name) => name.endsWith(".crl") && !name.endsWith("-chain.crl"))
      .map((name) => join(certs, name));
    server = createClientCertificateListener(
      app,
      {
        port: 0,
        certificate: process.env.TLS_CERT!,
        key: process.env.TLS_KEY!,
        ca: process.env.TLS_CA_SERVICES!,
        revocationLists,
      },
      {
        name: "ServicesListener",
        onRequest: (request) => {
          (request as AuthenticatedRequest).listener = "services";
        },
      },
    );
    await new Promise<void>((done) => {
      if (server.listening) done();
      else server.once("listening", () => done());
    });
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((done) => server?.close(done));
    await app?.close();
    process.env = saved;
  });

  /** GET a path as the holder of `identity`, or with no certificate. */
  const get = (
    path: string,
    identity?: string,
  ): Promise<{ status?: number; error?: string }> =>
    new Promise((done) => {
      const request = https.request(
        {
          host: "127.0.0.1",
          port,
          path,
          ca: fs.readFileSync(join(certs, "services-ca.crt")),
          servername: "localhost",
          ...(identity
            ? {
                cert: fs.readFileSync(join(certs, `${identity}.crt`)),
                key: fs.readFileSync(join(certs, `${identity}.key`)),
              }
            : {}),
        },
        (response) => {
          response.resume();
          response.on("end", () => done({ status: response.statusCode }));
        },
      );
      request.on("error", (error) => done({ error: error.message }));
      request.end();
    });

  it("serves the Olympus API by its certificate, with no token", async () => {
    expect(await get("/v1/calendar-accounts", "agents/olympus-api")).toEqual({
      status: 200,
    });
  });

  it("forbids another service's certificate", async () => {
    expect(
      await get("/v1/calendar-accounts", "agents/dionysus-search-agent"),
    ).toEqual({ status: 403 });
  });

  it("refuses a certificate from the device issuer", async () => {
    // services-ca.crt does not hold the device issuer, so the handshake
    // refuses it; were it trusted, the issuer check would (unit tests).
    const result = await get("/v1/calendar-accounts", "agents/svc-wrong-ca");
    expect(result.status).toBeUndefined();
  });

  it("refuses a connection without a certificate during the handshake", async () => {
    const result = await get("/v1/calendar-accounts");
    expect(result.status).toBeUndefined();
    expect(result.error).toBeDefined();
  });

  it("refuses a revoked certificate during the handshake", async () => {
    const result = await get("/v1/calendar-accounts", "agents/svc-revoked");
    expect(result.status).toBeUndefined();
  });
});
