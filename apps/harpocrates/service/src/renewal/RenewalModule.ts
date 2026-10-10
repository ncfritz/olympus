import { Module } from "@nestjs/common";
import { CertificatesModule } from "../certificates/CertificatesModule";
import { RenewPresentedCertificateController } from "./controllers/RenewPresentedCertificateController";
import { RenewalListener } from "./services/RenewalListener";
import { RenewalService } from "./services/RenewalService";
import { RenewalTlsService } from "./services/RenewalTlsService";

/** Renewal over mutual TLS, on its own listener (ADR 0020, Renewal and delivery). */
@Module({
  imports: [CertificatesModule],
  controllers: [RenewPresentedCertificateController],
  providers: [RenewalService, RenewalTlsService, RenewalListener],
  exports: [RenewalListener],
})
export class RenewalModule {}
