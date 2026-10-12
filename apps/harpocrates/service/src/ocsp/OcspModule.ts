import { Module } from "@nestjs/common";
import { KeysModule } from "../keys/KeysModule";
import { IssueCeremonyOcspResponderController } from "./controllers/IssueCeremonyOcspResponderController";
import { ListIssuerOcspRespondersController } from "./controllers/ListIssuerOcspRespondersController";
import { OcspResponderService } from "./services/OcspResponderService";
import { OcspResponseService } from "./services/OcspResponseService";
import { OcspService } from "./services/OcspService";

/**
 * OCSP (ADR 0036): each CA's responder, and the responses it signs
 * ahead; the list scheduler runs a pass after its lists.
 */
@Module({
  imports: [KeysModule],
  controllers: [
    ListIssuerOcspRespondersController,
    IssueCeremonyOcspResponderController,
  ],
  providers: [OcspResponderService, OcspResponseService, OcspService],
  exports: [OcspService, OcspResponseService, OcspResponderService],
})
export class OcspModule {}
