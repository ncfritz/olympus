import { createOlympusClients } from "@ncfritz/olympus-client";
import { type Answered, type Called, timed } from "./called";
import { createMutualTlsAdapter, type NativeRequest } from "./mutualTls";

/**
 * Calls on the services listener with a certificate: no token, no user, and the
 * identity in the handshake (ADR 0018). The CLI's `agent-call` does the same
 * thing with node's TLS options; here the transport is the native module, and
 * everything above it is the same generated SDK.
 */
export type ServiceCaller = {
  /** Any path, relative to the base URL. A 4xx is an answer, not a throw. */
  get(path: string): Promise<Called>;
};

export const createServiceCaller = (options: {
  /** The services listener, including the version: https://192.168.1.10:3443/v1 */
  baseUrl: string;
  /**
   * `X-Olympus-Client`. The API refuses a request where this and the
   * certificate's common name disagree, which is worth doing on purpose and not
   * worth doing by accident -- so it is the screen's to choose.
   */
  clientName: string;
  request: NativeRequest;
}): ServiceCaller => {
  const clients = createOlympusClients({
    baseUrl: options.baseUrl,
    clientName: options.clientName,
    axios: { adapter: createMutualTlsAdapter(options.request) },
  });

  return {
    get: (path) =>
      timed("GET", path, async (): Promise<Answered> => {
        const response = await clients.olympus.instance.request({
          method: "GET",
          url: path,
          // The status is the result here: a 403 from the border is the thing
          // being tested, so it has to come back rather than throw.
          validateStatus: () => true,
        });
        return { status: response.status, body: response.data };
      }),
  };
};
