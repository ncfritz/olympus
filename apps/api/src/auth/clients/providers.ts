/**
 * The identity providers the API is an OAuth client of (ADR 0018). The
 * client secrets make this a secret file rather than a setting:
 * `AUTH_OIDC_PROVIDERS_FILE` names it, and `EnvReader` reads any variable
 * from its `_FILE` twin.
 *
 * The same shape Minerva's agent uses, deliberately — it is the provider
 * configuration that already works in this codebase, and one session
 * across the suite (console plan phase 6) is easier from a common shape.
 */
export type ProviderConfig = {
  /** The `:provider` in /v1/auth/authorize and /v1/auth/callback/:provider. */
  name: string;
  /** Discovery starts here. */
  issuer: string;
  clientId: string;
  clientSecret: string;
};

const NAME = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * Parses the providers, collecting every problem rather than throwing on
 * the first: a boot that fails should say everything that is wrong with
 * the configuration, not make someone find it a line at a time.
 */
export const parseProviders = (
  raw: string,
  problems: string[],
): ProviderConfig[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: unknown) {
    problems.push(
      `AUTH_OIDC_PROVIDERS is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
  if (!Array.isArray(parsed)) {
    problems.push("AUTH_OIDC_PROVIDERS must be a JSON array");
    return [];
  }

  const providers: ProviderConfig[] = [];
  const seen = new Set<string>();
  parsed.forEach((entry: unknown, index) => {
    const at = `AUTH_OIDC_PROVIDERS[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      problems.push(`${at} must be an object`);
      return;
    }
    const { name, issuer, clientId, clientSecret } =
      entry as Partial<ProviderConfig>;
    for (const [key, value] of Object.entries({
      name,
      issuer,
      clientId,
      clientSecret,
    })) {
      if (typeof value !== "string" || value.trim() === "") {
        problems.push(`${at}.${key} is required`);
      }
    }
    if (typeof name !== "string" || !NAME.test(name)) {
      // It becomes a URL path segment and a stored identity's provider.
      problems.push(`${at}.name must match ${NAME.source}`);
      return;
    }
    if (seen.has(name)) {
      problems.push(`${at}.name "${name}" appears twice`);
      return;
    }
    if (typeof issuer !== "string" || !issuer.startsWith("https://")) {
      problems.push(`${at}.issuer must be an https URL`);
      return;
    }
    if (typeof clientId !== "string" || typeof clientSecret !== "string") {
      return;
    }
    seen.add(name);
    providers.push({ name, issuer, clientId, clientSecret });
  });
  return providers;
};
