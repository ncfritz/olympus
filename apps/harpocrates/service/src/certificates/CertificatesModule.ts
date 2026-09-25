import { Module } from "@nestjs/common";
import { IssuersModule } from "../issuers/IssuersModule";
import { ProfilesModule } from "../profiles/ProfilesModule";
import { CreateCertificateController } from "./controllers/CreateCertificateController";
import { DescribeCertificateController } from "./controllers/DescribeCertificateController";
import { DownloadCertificateController } from "./controllers/DownloadCertificateController";
import { ExportCertificateKeyController } from "./controllers/ExportCertificateKeyController";
import { ListCertificatesController } from "./controllers/ListCertificatesController";
import { RenewCertificateController } from "./controllers/RenewCertificateController";
import { RevokeCertificateController } from "./controllers/RevokeCertificateController";
import { CertificateService } from "./services/CertificateService";

@Module({
  imports: [IssuersModule, ProfilesModule],
  controllers: [
    ListCertificatesController,
    CreateCertificateController,
    DescribeCertificateController,
    DownloadCertificateController,
    RenewCertificateController,
    RevokeCertificateController,
    ExportCertificateKeyController,
  ],
  providers: [CertificateService],
  exports: [CertificateService],
})
export class CertificatesModule {}
