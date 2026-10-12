import { Module } from "@nestjs/common";
import { OcspModule } from "../ocsp/OcspModule";
import { ImportIssuerCrlController } from "./controllers/ImportIssuerCrlController";
import { ListIssuerCrlsController } from "./controllers/ListIssuerCrlsController";
import { SignCeremonyCrlController } from "./controllers/SignCeremonyCrlController";
import { CrlScheduler } from "./services/CrlScheduler";
import { CrlService } from "./services/CrlService";
import { PublicationService } from "./services/PublicationService";

@Module({
  imports: [OcspModule],
  controllers: [
    ListIssuerCrlsController,
    ImportIssuerCrlController,
    SignCeremonyCrlController,
  ],
  providers: [CrlService, PublicationService, CrlScheduler],
  exports: [CrlService, CrlScheduler],
})
export class CrlsModule {}
