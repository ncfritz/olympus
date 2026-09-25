import { loadOpenIdClient } from "@ncfritz/olympus-nest";
import { Inject, Injectable, Logger } from "@nestjs/common";
// Type-only: the package is ESM and is loaded through loadOpenIdClient.
import type * as OpenIdClient from "openid-client";
import { authConfig, type AuthConfigType } from "../../config/configuration";
import type { ProviderConfig } from "../clients/providers";

/**
 * The providers the API signs people in with, and their discovery documents.
 *
 * Discovery is cached as the promise rather than the result, so concurrent
 * first sign-ins share one fetch instead of racing. It is never refreshed:
 * a provider that rotates its keys or moves an endpoint needs a restart,
 * which is a trade worth making while there are three providers and one
 * process — an automatic refresh is a way for a sign-in to start working
 * against one document and finish against another.
 */
@Injectable()
export class OidcProviderRegistry {
  private readonly logger = new Logger(OidcProviderRegistry.name);
  private readonly discovered = new Map<
    string,
    Promise<OpenIdClient.Configuration>
  >();

  constructor(@Inject(authConfig.KEY) private readonly auth: AuthConfigType) {}

  /** The configured providers, by name. */
  names(): string[] {
    return this.auth.users.providers.map((provider) => provider.name);
  }

  config(name: string): ProviderConfig | undefined {
    return this.auth.users.providers.find((provider) => provider.name === name);
  }

  /** The provider's discovery document, fetched once. */
  async discover(name: string): Promise<OpenIdClient.Configuration> {
    const provider = this.config(name);
    if (provider === undefined) {
      throw new Error(`no provider named "${name}"`);
    }
    let discovery = this.discovered.get(name);
    if (discovery === undefined) {
      this.logger.log(`discovering ${name} at ${provider.issuer}`);
      discovery = loadOpenIdClient()
        .then((client) =>
          client.discovery(
            new URL(provider.issuer),
            provider.clientId,
            provider.clientSecret,
          ),
        )
        .catch((error: unknown) => {
          // Do not cache a failure: the next sign-in should try again rather
          // than inherit a provider that was briefly unreachable.
          this.discovered.delete(name);
          throw error;
        });
      this.discovered.set(name, discovery);
    }
    return discovery;
  }
}
