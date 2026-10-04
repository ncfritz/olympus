import {
  BadGatewayException,
  ServiceUnavailableException,
} from "@nestjs/common";
import * as fs from "fs";
import * as https from "https";
import type { AddressInfo } from "net";
import * as path from "path";
import type { TLSSocket } from "tls";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { MinervaConfigType } from "../../../../src/config/configuration";
import { MinervaCalendarAgentClient } from "../../../../src/minerva/calendars/services/MinervaCalendarAgentClient";
import { devCa } from "../../../support/devCa";

const certs = devCa();
const file = (name: string) => path.join(certs, name);
const hasAgentCertificates =
  fs.existsSync(file("minerva-calendar-sync.crt")) &&
  fs.existsSync(file("agents/olympus-api.crt"));

const ACCOUNT = {
  accountLabel: "me@example.com",
  provider: "google",
  subject: "google-sub",
  sources: ["Personal"],
  status: "ok",
};

/**
 * The client against a stand-in for the agent's services listener, with
 * the certificates of scripts/dev-ca.sh: the API presents its own client
 * certificate (ADR 0028). A dev CA from before those certificates existed
 * needs `scripts/dev-ca.sh --force`.
 */
describe.skipIf(!hasAgentCertificates)("MinervaCalendarAgentClient", () => {
  let server: https.Server;
  let port: number;
  let seen: { caller?: string; header?: string; path?: string } = {};
  let answer = {
    status: 200,
    body: { calendarAccounts: [ACCOUNT] } as unknown,
  };

  beforeAll(async () => {
    server = https.createServer(
      {
        cert: fs.readFileSync(file("minerva-calendar-sync.crt")),
        key: fs.readFileSync(file("minerva-calendar-sync.key")),
        ca: fs.readFileSync(file("services-ca.crt")),
        requestCert: true,
        rejectUnauthorized: true,
      },
      (request, response) => {
        const peer = (request.socket as TLSSocket).getPeerCertificate();
        seen = {
          caller: peer.subject?.CN as string | undefined,
          header: request.headers["x-olympus-client"] as string | undefined,
          path: request.url,
        };
        response.writeHead(answer.status, {
          "content-type": "application/json",
        });
        response.end(JSON.stringify(answer.body));
      },
    );
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((done) => server.close(done));
  });

  const client = (
    overrides: Partial<NonNullable<MinervaConfigType["calendarAgent"]>> = {},
  ) =>
    new MinervaCalendarAgentClient({
      calendarAgent: {
        baseUrl: `https://localhost:${port}/v1`,
        tls: {
          certificate: file("agents/olympus-api.crt"),
          key: file("agents/olympus-api.key"),
          ca: file("services-ca.crt"),
        },
        timeoutMs: 2000,
        ...overrides,
      },
    });

  it("lists the agent's accounts, as olympus-api by certificate and by header", async () => {
    answer = { status: 200, body: { calendarAccounts: [ACCOUNT] } };

    await expect(client().listCalendarAccounts()).resolves.toEqual([ACCOUNT]);
    expect(seen).toEqual({
      caller: "olympus-api",
      header: "olympus-api",
      path: "/v1/calendar-accounts",
    });
  });

  it("answers 502 when the agent fails", async () => {
    answer = { status: 500, body: { message: "boom" } };

    await expect(client().listCalendarAccounts()).rejects.toThrow(
      BadGatewayException,
    );
  });

  it("answers 502 when the agent cannot be reached", async () => {
    await expect(
      client({ baseUrl: "https://localhost:1/v1" }).listCalendarAccounts(),
    ).rejects.toThrow(BadGatewayException);
  });

  it("answers 503 when no agent is configured", async () => {
    await expect(
      new MinervaCalendarAgentClient({}).listCalendarAccounts(),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
