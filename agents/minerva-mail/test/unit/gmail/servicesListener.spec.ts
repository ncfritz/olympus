import { createClientCertificateListener } from "@ncfritz/olympus-nest";
import { type INestApplication, VersioningType } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as fs from "fs";
import * as https from "https";
import * as os from "os";
import * as path from "path";
import type { Server } from "https";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ServicesRequest } from "../../../src/auth/ServicesOnlyGuard";
import { gmailConfig, servicesConfig } from "../../../src/config/configuration";
import { GmailModule } from "../../../src/gmail/GmailModule";
import { certs, DEV_CA, revocationLists } from "../../support/devCa";

/**
 * The management API over a real services listener: the API's certificate
 * gets in; another service's is refused; the plain listener refuses all.
 */
describe("the services listener", () => {
  let app: INestApplication;
  let server: Server;
  let port: number;
  let plainPort: number;
  let dir: string;

  const request = (
    method: string,
    url: string,
    identity: string,
    body?: unknown,
  ) =>
    new Promise<{ status?: number; body: string }>((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = https.request(
        {
          host: "127.0.0.1",
          port,
          path: url,
          method,
          servername: "localhost",
          ca: fs.readFileSync(path.join(DEV_CA, "services-ca.crt")),
          ...certs(`agents/${identity}`),
          headers: payload
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(payload),
              }
            : {},
        },
        (res) => {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => resolve({ status: res.statusCode, body: text }));
        },
      );
      req.on("error", reject);
      req.end(payload);
    });

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gmail-creds-"));
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [gmailConfig, servicesConfig],
        }),
        GmailModule,
      ],
    })
      .overrideProvider(gmailConfig.KEY)
      .useValue({
        clientId: "client-id",
        clientSecret: "client-secret",
        credentialsDir: dir,
        scopes: ["openid"],
      })
      .overrideProvider(servicesConfig.KEY)
      .useValue({ clients: ["olympus-api"] })
      .compile();
    app = moduleRef.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    await app.listen(0);
    plainPort = (app.getHttpServer().address() as { port: number }).port;
    server = createClientCertificateListener(
      app,
      {
        port: 0,
        certificate: path.join(DEV_CA, "minerva-mail-agent.crt"),
        key: path.join(DEV_CA, "minerva-mail-agent.key"),
        ca: path.join(DEV_CA, "services-ca.crt"),
        revocationLists: revocationLists(),
      },
      {
        name: "ServicesListener",
        onRequest: (r) => {
          (r as ServicesRequest).listener = "services";
        },
      },
    );
    await new Promise((resolve) => server.once("listening", resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    server.close();
    await app.close();
  });

  it("lets the API start a sign-in", async () => {
    const res = await request("POST", "/v1/gmail-sign-ins", "olympus-api", {
      redirectUri:
        "https://olympus.example.test/api/v1/minerva/mail/accounts/callback",
      state: "s",
      codeChallenge: "c",
      email: "neil@example.test",
    });
    expect(res.status).toBe(200);
    const url = new URL(JSON.parse(res.body).authUrl);
    expect(url.host).toBe("accounts.google.com");
    expect(url.searchParams.get("login_hint")).toBe("neil@example.test");
  });

  it("answers 400 to a sign-in missing its state", async () => {
    const res = await request("POST", "/v1/gmail-sign-ins", "olympus-api", {
      redirectUri: "https://x/cb",
      codeChallenge: "c",
      email: "neil@example.test",
    });
    expect(res.status).toBe(400);
  });

  it("lists the linked mailboxes, without tokens", async () => {
    fs.writeFileSync(
      path.join(dir, "neil%40example.test.json"),
      JSON.stringify({
        email: "neil@example.test",
        subject: "g-1",
        refreshToken: "secret-token",
        scope: "openid",
        obtainedAt: "2026-10-06T00:00:00.000Z",
      }),
    );
    const res = await request("GET", "/v1/gmail-accounts", "olympus-api");
    expect(res.status).toBe(200);
    expect(res.body).not.toContain("secret-token");
    expect(JSON.parse(res.body).accounts).toEqual([
      {
        email: "neil@example.test",
        subject: "g-1",
        scope: "openid",
        obtainedTime: "2026-10-06T00:00:00.000Z",
      },
    ]);
    const gone = await request(
      "DELETE",
      "/v1/gmail-account/neil%40example.test",
      "olympus-api",
    );
    expect(gone.status).toBe(204);
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("refuses another service, even with a good certificate", async () => {
    const res = await request("GET", "/v1/gmail-accounts", "minerva-mail-ml");
    expect(res.status).toBe(403);
  });

  it("refuses everything on the plain listener", async () => {
    const res = await fetch(`http://127.0.0.1:${plainPort}/v1/gmail-accounts`);
    expect(res.status).toBe(401);
  });
});
