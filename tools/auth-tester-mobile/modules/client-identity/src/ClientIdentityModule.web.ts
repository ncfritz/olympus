import { NativeModule, registerWebModule } from "expo";
import type { ImportedIdentity, ServiceAnswer } from "./ClientIdentity.types";

/**
 * There is no web implementation, and there cannot be one: the certificate
 * store belongs to the browser, and a page is not allowed to choose from it or
 * to hold a key. The site authenticates a person with a token (ADR 0018); this
 * module is for the service border, which is a native concern.
 */
const UNAVAILABLE =
  "client certificates cannot be presented from a browser: the certificate store belongs to the browser, and a page cannot choose from it";

class ClientIdentityModule extends NativeModule<Record<never, never>> {
  importIdentity(): Promise<ImportedIdentity> {
    throw new Error(UNAVAILABLE);
  }
  trustAuthorities(): Promise<number> {
    throw new Error(UNAVAILABLE);
  }
  forget(): void {
    throw new Error(UNAVAILABLE);
  }
  hasIdentity(): boolean {
    return false;
  }
  request(): Promise<ServiceAnswer> {
    throw new Error(UNAVAILABLE);
  }
}

export default registerWebModule(ClientIdentityModule, "ClientIdentityModule");
