export interface OidcProviderConfig {
  /** e.g. "google" — used in the /auth/login/:name and /auth/callback/:name routes. */
  name: string;
  /** The provider's issuer URL, used for OIDC discovery. */
  issuer: string;
  clientId: string;
  clientSecret: string;
}

export function parseOidcProviders(raw: string): OidcProviderConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `AUTH_OIDC_PROVIDERS is not valid JSON: ${(error as Error).message}`,
      { cause: error },
    );
  }

  if (!Array.isArray(parsed)) {
    throw new Error("AUTH_OIDC_PROVIDERS must be a JSON array");
  }

  return parsed.map((entry, index) => {
    const { name, issuer, clientId, clientSecret } =
      entry as Partial<OidcProviderConfig>;
    if (!name || !issuer || !clientId || !clientSecret) {
      throw new Error(
        `AUTH_OIDC_PROVIDERS[${index}] must have { name, issuer, clientId, clientSecret }`,
      );
    }
    return { name, issuer, clientId, clientSecret };
  });
}
