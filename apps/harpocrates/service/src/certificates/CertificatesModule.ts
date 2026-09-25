import { Module } from "@nestjs/common";
import { CrlsModule } from "../crls/CrlsModule";
import { IssuersModule } from "../issuers/IssuersModule";
import { ProfilesModule } from "../profiles/ProfilesModule";
import { CreateCertificateController } from "./controllers/CreateCertificateController";
import { DescribeCertificateController } from "./controllers/DescribeCertificateController";
import { DownloadCertificateController } from "./controllers/DownloadCertificateController";
import { ExportCertificateKeyController } from "./controllers/ExportCertificateKeyController";
import { ImportCertificatesController } from "./controllers/ImportCertificatesController";
import { ListCertificatesController } from "./controllers/ListCertificatesController";
import { RenewCertificateController } from "./controllers/RenewCertificateController";
import { RevokeCertificateController } from "./controllers/RevokeCertificateController";
import { CertificateImportService } from "./services/CertificateImportService";
import { CertificateService } from "./services/CertificateService";

@Module({
  imports: [IssuersModule, ProfilesModule, CrlsModule],
  controllers: [
    ListCertificatesController,
    CreateCertificateController,
    DescribeCertificateController,
    DownloadCertificateController,
    RenewCertificateController,
    RevokeCertificateController,
    ExportCertificateKeyController,
    ImportCertificatesController,
  ],
  providers: [CertificateService, CertificateImportService],
  exports: [CertificateService, CertificateImportService],
})
export class CertificatesModule {}
