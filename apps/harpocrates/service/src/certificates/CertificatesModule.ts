import { Module } from "@nestjs/common";
import { CrlsModule } from "../crls/CrlsModule";
import { IssuersModule } from "../issuers/IssuersModule";
import { ProfilesModule } from "../profiles/ProfilesModule";
import { SshModule } from "../ssh/SshModule";
import { AddCertificateCsrController } from "./controllers/AddCertificateCsrController";
import { AddCertificateKeyController } from "./controllers/AddCertificateKeyController";
import { CreateCertificateController } from "./controllers/CreateCertificateController";
import { DescribeCertificateController } from "./controllers/DescribeCertificateController";
import { DownloadCertificateController } from "./controllers/DownloadCertificateController";
import { ExportCertificateKeyController } from "./controllers/ExportCertificateKeyController";
import { ImportCertificatesController } from "./controllers/ImportCertificatesController";
import { ListCertificateLineagesController } from "./controllers/ListCertificateLineagesController";
import { ListCertificatesController } from "./controllers/ListCertificatesController";
import { PreviewProfileController } from "./controllers/PreviewProfileController";
import { RenewCertificateController } from "./controllers/RenewCertificateController";
import { RevokeCertificateController } from "./controllers/RevokeCertificateController";
import { CertificateImportService } from "./services/CertificateImportService";
import { CertificateService } from "./services/CertificateService";
import { LineageService } from "./services/LineageService";

@Module({
  imports: [IssuersModule, ProfilesModule, CrlsModule, SshModule],
  controllers: [
    ListCertificatesController,
    ListCertificateLineagesController,
    CreateCertificateController,
    DescribeCertificateController,
    DownloadCertificateController,
    RenewCertificateController,
    RevokeCertificateController,
    ExportCertificateKeyController,
    ImportCertificatesController,
    AddCertificateKeyController,
    AddCertificateCsrController,
    PreviewProfileController,
  ],
  providers: [CertificateService, CertificateImportService, LineageService],
  exports: [CertificateService, CertificateImportService],
})
export class CertificatesModule {}
