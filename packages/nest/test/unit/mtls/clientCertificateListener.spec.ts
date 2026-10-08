import type { INestApplication } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as tls from "tls";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createClientCertificateListener,
  refusalMessage,
} from "../../../src/mtls/clientCertificateListener";

/** The repository's dev CA (`scripts/dev-ca.sh`), run once first. */
const DEV_CA = path.resolve(__dirname, "../../../../../infra/dev-ca/certs");

describe("refusalMessage", () => {
  it("names the caller's address", () => {
    expect(
      refusalMessage(
        new Error("peer did not return a certificate"),
        "10.210.3.7:51234",
      ),
    ).toBe(
      "Refused a connection from 10.210.3.7:51234: peer did not return a certificate",
    );
  });

  it.each([
    "ssl/tls alert certificate unknown",
    "tlsv1 alert unknown ca",
    "ssl/tls alert bad certificate",
  ])(
    "says when the caller refused this listener's certificate (%s)",
    (alert) => {
      expect(
        refusalMessage(new Error(`ssl3_read_bytes:${alert}`), undefined),
      ).toMatch(
        /^Refused a connection from an unknown address: .*the caller refused this listener's certificate/,
      );
    },
  );

  it("does not blame the listener for the caller's own certificate", () => {
    expect(
      refusalMessage(new Error("certificate verify failed"), "127.0.0.1:1"),
    ).not.toMatch(/caller refused/);
  });
});

describe.skipIf(!fs.existsSync(path.join(DEV_CA, "agents/olympus-api.crt")))(
  "a refused handshake",
  () => {
    let server: ReturnType<typeof createClientCertificateListener> | undefined;
    afterEach(() => {
      server?.close();
      vi.restoreAllMocks();
    });

    it("is logged with the caller's address, which the torn-down socket no longer has", async () => {
      const warn = vi
        .spyOn(Logger.prototype, "warn")
        .mockImplementation(() => undefined);
      vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
      const app = {
        getHttpAdapter: () => ({ getInstance: () => () => undefined }),
      } as unknown as INestApplication;
      server = createClientCertificateListener(
        app,
        {
          port: 0,
          certificate: path.join(DEV_CA, "api.crt"),
          key: path.join(DEV_CA, "api.key"),
          ca: path.join(DEV_CA, "services-ca.crt"),
          revocationLists: [],
        },
        { name: "ServicesListener" },
      );
      await new Promise((resolve) => server!.once("listening", resolve));
      const { port } = server.address() as { port: number };

      // A caller that does not trust the listener's certificate hangs up
      // mid-handshake; by the time that is reported, the TLS socket has
      // no address left.
      const refused = new Promise((resolve) =>
        server!.once("tlsClientError", resolve),
      );
      const client = tls.connect({
        port,
        host: "127.0.0.1",
        servername: "localhost",
        // Trusting only the listener's own certificate and no root: Node
        // does not accept a chain that ends short of one.
        ca: fs.readFileSync(path.join(DEV_CA, "api.crt")),
        cert: fs.readFileSync(path.join(DEV_CA, "agents/olympus-api.crt")),
        key: fs.readFileSync(path.join(DEV_CA, "agents/olympus-api.key")),
      });
      client.on("error", () => undefined);
      await refused;
      client.destroy();

      const lines = warn.mock.calls.map(([m]) => String(m));
      expect(
        lines.some((m) =>
          /^Refused a connection from 127\.0\.0\.1:\d+: /.test(m),
        ),
      ).toBe(true);
    });
  },
);
