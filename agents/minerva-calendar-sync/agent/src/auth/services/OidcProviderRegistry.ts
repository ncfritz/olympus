import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
// openid-client is ESM-only; this project's CJS output can't `require()` it
// directly, so every call site loads it via dynamic `import()` instead (see
// the `loadOpenIdClient` helper). Type-only import here costs nothing at
// runtime — it's erased entirely by the compiler.
import type * as OpenIdClient from "openid-client";
import { loadOpenIdClient } from "../openidClientLoader";
import { OidcProviderConfig, parseOidcProviders } from "../oidcProviderConfig";

/**
 * Login providers, configured entirely separately from CalendarProviderRegistry
 * — this is about *who may sign into the app*, not which calendars get synced.
 * Discovery documents are fetched once per provider and cached.
 */
@Injectable()
export class OidcProviderRegistry {
  private readonly providers: Map<string, OidcProviderConfig>;
  private readonly discovered = new Map<
    string,
    Promise<OpenIdClient.Configuration>
  >();

  constructor(config: ConfigService) {
    const raw = config.get<string>("AUTH_OIDC_PROVIDERS");
    const list = raw ? parseOidcProviders(raw) : [];
    this.providers = new Map(list.map((p) => [p.name, p]));
  }

  getProviderConfig(name: string): OidcProviderConfig {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotFoundException(`Unknown login provider "${name}"`);
    }
    return provider;
  }

  async getOidcConfig(name: string): Promise<OpenIdClient.Configuration> {
    const provider = this.getProviderConfig(name);

    let discovery = this.discovered.get(name);
    if (!discovery) {
      discovery = loadOpenIdClient().then((client) =>
        client.discovery(
          new URL(provider.issuer),
          provider.clientId,
          provider.clientSecret,
        ),
      );
      this.discovered.set(name, discovery);
    }
    return discovery;
  }
}
