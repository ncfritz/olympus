import { Module } from "@nestjs/common";
import { CreateCeremonyCertificateController } from "./controllers/CreateCeremonyCertificateController";
import { IssuersModule } from "../issuers/IssuersModule";
import { CrlsModule } from "../crls/CrlsModule";
import { CertificatesModule } from "../certificates/CertificatesModule";
import { CloseCeremonyController } from "./controllers/CloseCeremonyController";
import { CreateIntermediateIssuerController } from "./controllers/CreateIntermediateIssuerController";
import { CreateIssuingIssuerController } from "./controllers/CreateIssuingIssuerController";
import { DescribeCeremonyController } from "./controllers/DescribeCeremonyController";
import { OpenCeremonyController } from "./controllers/OpenCeremonyController";
import { CeremonyService } from "./services/CeremonyService";

@Module({
  imports: [IssuersModule, CrlsModule, CertificatesModule],
  controllers: [
    OpenCeremonyController,
    DescribeCeremonyController,
    CloseCeremonyController,
    CreateIntermediateIssuerController,
    CreateIssuingIssuerController,
    CreateCeremonyCertificateController,
  ],
  providers: [CeremonyService],
})
export class CeremoniesModule {}
