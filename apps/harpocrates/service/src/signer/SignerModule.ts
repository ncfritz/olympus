import { Global, Module } from "@nestjs/common";
import { InitialiseSignerController } from "./controllers/InitialiseSignerController";
import { DescribeSignerStatusController } from "./controllers/DescribeSignerStatusController";
import { SealSignerController } from "./controllers/SealSignerController";
import { UnsealSignerController } from "./controllers/UnsealSignerController";
import { SealService } from "./services/SealService";
import { SignerService } from "./services/SignerService";

/** The signer, over its socket (ADR 0020), and its seal. */
@Global()
@Module({
  controllers: [
    DescribeSignerStatusController,
    SealSignerController,
    UnsealSignerController,
    InitialiseSignerController,
  ],
  providers: [SignerService, SealService],
  exports: [SignerService],
})
export class SignerModule {}
