import { Module } from "@nestjs/common";
import { AcmeAccountController } from "./controllers/AcmeAccountController";
import { AcmeDirectoryController } from "./controllers/AcmeDirectoryController";
import { AcmeNewAccountController } from "./controllers/AcmeNewAccountController";
import { AcmeNewNonceController } from "./controllers/AcmeNewNonceController";
import { AcmeNewNonceHeadController } from "./controllers/AcmeNewNonceHeadController";
import { CreateAcmeCredentialController } from "./controllers/CreateAcmeCredentialController";
import { ListAcmeCredentialsController } from "./controllers/ListAcmeCredentialsController";
import { RevokeAcmeCredentialController } from "./controllers/RevokeAcmeCredentialController";
import { AcmeExceptionFilter, AcmeHeadersInterceptor } from "./acmeRoute";
import { AcmeAccountService } from "./services/AcmeAccountService";
import { AcmeCredentialService } from "./services/AcmeCredentialService";
import { AcmeDirectoryService } from "./services/AcmeDirectoryService";
import { AcmeJwsService } from "./services/AcmeJwsService";
import { AcmeNonceService } from "./services/AcmeNonceService";
import { AcmeUrls } from "./services/AcmeUrls";

/**
 * ACME (ADR 0020, ACME; RFC 8555) on the renewal listener, for the TLS CA,
 * and the management API's External Account Binding credentials.
 */
@Module({
  controllers: [
    AcmeDirectoryController,
    AcmeNewNonceHeadController,
    AcmeNewNonceController,
    AcmeNewAccountController,
    AcmeAccountController,
    ListAcmeCredentialsController,
    CreateAcmeCredentialController,
    RevokeAcmeCredentialController,
  ],
  providers: [
    AcmeUrls,
    AcmeNonceService,
    AcmeJwsService,
    AcmeDirectoryService,
    AcmeAccountService,
    AcmeCredentialService,
    AcmeExceptionFilter,
    AcmeHeadersInterceptor,
  ],
})
export class AcmeModule {}
