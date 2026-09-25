import { Module } from "@nestjs/common";
import { IssuersModule } from "../issuers/IssuersModule";
import { CloseCeremonyController } from "./controllers/CloseCeremonyController";
import { CreateIntermediateIssuerController } from "./controllers/CreateIntermediateIssuerController";
import { CreateIssuingIssuerController } from "./controllers/CreateIssuingIssuerController";
import { DescribeCeremonyController } from "./controllers/DescribeCeremonyController";
import { OpenCeremonyController } from "./controllers/OpenCeremonyController";
import { CeremonyService } from "./services/CeremonyService";

@Module({
  imports: [IssuersModule],
  controllers: [
    OpenCeremonyController,
    DescribeCeremonyController,
    CloseCeremonyController,
    CreateIntermediateIssuerController,
    CreateIssuingIssuerController,
  ],
  providers: [CeremonyService],
})
export class CeremoniesModule {}
