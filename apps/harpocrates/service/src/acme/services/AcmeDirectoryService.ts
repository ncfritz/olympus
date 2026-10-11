import { Injectable } from "@nestjs/common";
import { AcmeUrls } from "./AcmeUrls";

/** The directory (RFC 8555 §7.1.1): where everything else is. */
@Injectable()
export class AcmeDirectoryService {
  constructor(private readonly urls: AcmeUrls) {}

  directory(): Record<string, unknown> {
    return {
      newNonce: this.urls.newNonce(),
      newAccount: this.urls.newAccount(),
      newOrder: this.urls.newOrder(),
      revokeCert: this.urls.revokeCert(),
      keyChange: this.urls.keyChange(),
      renewalInfo: this.urls.renewalInfo(),
      meta: {
        externalAccountRequired: true,
        website: "https://pki.internal.ncfritz.net/",
      },
    };
  }
}
