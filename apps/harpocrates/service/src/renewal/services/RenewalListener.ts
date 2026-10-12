import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import * as https from "https";
import type { AddressInfo } from "net";
import { markRenewalRequest } from "../../auth/clientCertificate";
import {
  renewalConfig,
  type RenewalConfigType,
} from "../../config/configuration";
import { type ListenerIdentity, RenewalTlsService } from "./RenewalTlsService";

/** How often the listener's certificate is checked: issued if still missing, renewed when due. */
const CHECK_MS = 5 * 60 * 1000;

const contextOf = (identity: ListenerIdentity): https.ServerOptions => ({
  key: identity.key,
  cert: identity.cert,
  // Asked for, not required (ADR 0020, Surfaces): each route decides what
  // it accepts. Any certificate gets through the handshake, which has
  // proved the caller holds its key; the route then checks it is one
  // Harpocrates issued, from its own records.
  requestCert: true,
  rejectUnauthorized: false,
});

/**
 * The renewal listener on RENEWAL_LISTEN_PORT (9443, ADR 0020): HTTPS
 * with Harpocrates's own certificate from the TLS CA, a client
 * certificate requested, serving the @ClientCertificate(), @AcmeRoute()
 * and @SignedRenewal() routes and nothing else (the guard sees to that). It starts once that certificate
 * can be had, which needs a TLS issuing CA and an unsealed signer, so on
 * a new install it waits; it swaps in a renewed certificate without a
 * restart.
 */
@Injectable()
export class RenewalListener
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RenewalListener.name);
  private server?: https.Server;
  private timer?: NodeJS.Timeout;
  private serving?: Date;
  private waitingLogged = false;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly identity: RenewalTlsService,
    @Inject(renewalConfig.KEY) private readonly config: RenewalConfigType,
  ) {}

  onApplicationBootstrap(): void {
    // Off, or an application context without HTTP (the CLI).
    if (this.config.port === 0 || !this.adapterHost.httpAdapter) return;
    this.timer = setInterval(() => void this.check(), CHECK_MS);
    void this.check();
  }

  async onApplicationShutdown(): Promise<void> {
    clearInterval(this.timer);
    const server = this.server;
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  /** The port it listens on, once it does: for tests that ask for port 0's choice. */
  address(): AddressInfo | undefined {
    return (this.server?.address() as AddressInfo | null) ?? undefined;
  }

  /** Starts the listener, or swaps in a renewed certificate. */
  async check(): Promise<void> {
    let identity: ListenerIdentity;
    try {
      identity = await this.identity.current();
    } catch (error) {
      if (!this.waitingLogged || this.server) {
        this.logger.warn(
          `The renewal listener's certificate cannot be had yet: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.waitingLogged = true;
      }
      return;
    }
    if (this.server) {
      if (identity.notAfter.getTime() !== this.serving?.getTime()) {
        this.server.setSecureContext(contextOf(identity));
        this.serving = identity.notAfter;
        this.logger.log("Serving the renewed listener certificate");
      }
      return;
    }
    const express = this.adapterHost.httpAdapter.getInstance() as (
      request: unknown,
      response: unknown,
    ) => void;
    const server = https.createServer(
      contextOf(identity),
      (request, response) => {
        markRenewalRequest(request);
        express(request, response);
      },
    );
    this.server = server;
    this.serving = identity.notAfter;
    await new Promise<void>((resolve) =>
      server.listen(this.config.port, () => resolve()),
    );
    this.logger.log(
      `Renewal listener on ${this.address()?.port ?? this.config.port} (client certificates)`,
    );
  }
}
