import { createServer, type IncomingMessage, type Server } from "http";
import { generateKeyPairSync, sign, type KeyObject } from "crypto";
import type { AddressInfo } from "net";

/** A request the fake API received. */
export interface ReceivedRequest {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

/** An answer the fake gives a path, by `METHOD /path`. */
export interface FakeAnswer {
  status: number;
  body?: unknown;
}

/**
 * Just enough of the Olympus API for the agent's tests (ADR 0029): the keys
 * it signs access tokens with, published at /.well-known/jwks.json, and
 * whatever answers a test sets for the endpoints the agent calls. Every
 * request is recorded.
 */
export class OlympusFake {
  readonly received: ReceivedRequest[] = [];
  private readonly answers = new Map<string, FakeAnswer[]>();
  private readonly privateKey: KeyObject;
  private readonly jwk: Record<string, unknown>;
  private server?: Server;
  url = "";

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    this.privateKey = privateKey;
    this.jwk = {
      ...publicKey.export({ format: "jwk" }),
      kid: "e2e-key",
      alg: "ES256",
      use: "sig",
    };
  }

  async start(): Promise<string> {
    this.server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk: Buffer) => (body += chunk.toString()));
      req.on("end", () => {
        const url = req.url ?? "/";
        this.received.push({
          method: req.method ?? "GET",
          url,
          headers: req.headers,
          body,
        });
        if (url === "/.well-known/jwks.json") {
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ keys: [this.jwk] }));
          return;
        }
        const path = url.split("?")[0];
        const queued = this.answers.get(`${req.method} ${path}`);
        const answer =
          queued && queued.length > 1 ? queued.shift() : queued?.[0];
        if (!answer) {
          res.statusCode = 404;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({ message: `no answer for ${req.method} ${path}` }),
          );
          return;
        }
        res.statusCode = answer.status;
        if (answer.body === undefined) {
          res.end();
          return;
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(answer.body));
      });
    });
    await new Promise<void>((resolve) =>
      this.server!.listen(0, "127.0.0.1", resolve),
    );
    const { port } = this.server.address() as AddressInfo;
    this.url = `http://127.0.0.1:${port}`;
    return this.url;
  }

  /** What `METHOD /path` answers from now on; several are answered in turn, the last for good. */
  answer(route: string, ...answers: FakeAnswer[]): void {
    this.answers.set(route, answers);
  }

  /** Forgets every answer and request: one test's fake is not the next one's. */
  reset(): void {
    this.answers.clear();
    this.received.length = 0;
  }

  /** The requests to `METHOD /path`, its query aside. */
  requests(route: string): ReceivedRequest[] {
    return this.received.filter(
      (r) => `${r.method} ${r.url.split("?")[0]}` === route,
    );
  }

  /**
   * An access token as the API signs one: ES256, audience olympus-api.
   * Synchronous, so a test can build a header inline.
   */
  token(
    claims: { sub?: string; roles?: string[]; exp?: number } = {},
    signer: KeyObject = this.privateKey,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "ES256", kid: "e2e-key", typ: "JWT" };
    const payload = {
      sub: claims.sub ?? E2E_USER_ID,
      aud: "olympus-api",
      client_id: "minerva-calendar-console",
      sid: "e2e-session",
      roles: claims.roles ?? ["admin"],
      auth_time: now,
      iat: now,
      exp: claims.exp ?? now + 600,
    };
    const encode = (part: object) =>
      Buffer.from(JSON.stringify(part)).toString("base64url");
    const input = `${encode(header)}.${encode(payload)}`;
    const signature = sign("sha256", Buffer.from(input), {
      key: signer,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
    return `${input}.${signature}`;
  }
}

/** The Olympus user the e2e tests sign in as. */
export const E2E_USER_ID = "0b2c7a2e-0000-4000-8000-0000000000e2";

/** The fake every e2e test file talks to, started by env-setup.ts. */
export const olympus = new OlympusFake();
