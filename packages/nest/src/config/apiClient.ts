import type { EnvReader } from "./EnvReader";

/**
 * How a service reaches the Olympus API. The certificate is what the API's
 * mTLS listener identifies the caller by (ADR 0018); its shape is
 * `ClientTlsOptions` in `@ncfritz/olympus-client/tls`.
 */
export type ApiClientConfig = {
  /** Base URL including the version, e.g. https://olympus-api:3443/v1 */
  baseUrl: string;
  /** Unset until the service has a certificate: the calls are plain HTTP. */
  tls?: {
    certificate: string;
    key: string;
    ca?: string;
  };
};

/**
 * API_BASE_URL, and API_CLIENT_CERT with API_CLIENT_KEY (and the optional
 * API_CA_CERT) when the service authenticates with a certificate.
 */
export const readApiClientConfig = (
  read: EnvReader,
  defaultBaseUrl: string,
): ApiClientConfig => {
  const baseUrl = read.string("API_BASE_URL", defaultBaseUrl);
  const certificate = read.optional("API_CLIENT_CERT");
  const key = read.optional("API_CLIENT_KEY");
  const ca = read.optional("API_CA_CERT");

  if (!certificate && !key) {
    if (baseUrl.startsWith("https:")) {
      read.problems.push(
        "API_CLIENT_CERT and API_CLIENT_KEY are required for an https API_BASE_URL",
      );
    }
    return { baseUrl };
  }
  if (!certificate || !key) {
    read.problems.push("API_CLIENT_CERT and API_CLIENT_KEY are set together");
    return { baseUrl };
  }
  return { baseUrl, tls: { certificate, key, ca } };
};
