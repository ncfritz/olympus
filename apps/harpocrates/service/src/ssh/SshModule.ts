import { Module } from "@nestjs/common";
import { KeysModule } from "../keys/KeysModule";
import { ProfilesModule } from "../profiles/ProfilesModule";
import { CreateSshHostCertificateController } from "./controllers/CreateSshHostCertificateController";
import { CreateSshUserCertificateController } from "./controllers/CreateSshUserCertificateController";
import { DescribeMySshController } from "./controllers/DescribeMySshController";
import { DescribeSshCertificateController } from "./controllers/DescribeSshCertificateController";
import { ListSshCertificatesController } from "./controllers/ListSshCertificatesController";
import { RevokeSshCertificateController } from "./controllers/RevokeSshCertificateController";
import { CreateSshCaController } from "./controllers/CreateSshCaController";
import { DescribeSshCaController } from "./controllers/DescribeSshCaController";
import { ListSshCasController } from "./controllers/ListSshCasController";
import { ListSshPrincipalsController } from "./controllers/ListSshPrincipalsController";
import { RetireSshCaController } from "./controllers/RetireSshCaController";
import { SetSshPrincipalsController } from "./controllers/SetSshPrincipalsController";
import { SshCaService } from "./services/SshCaService";
import { SshCertificateService } from "./services/SshCertificateService";
import { SshKrlService } from "./services/SshKrlService";
import { SshPrincipalService } from "./services/SshPrincipalService";

/** SSH CAs, who may log in as whom, SSH certificates and KRLs (ADR 0035). */
@Module({
  imports: [KeysModule, ProfilesModule],
  controllers: [
    ListSshCasController,
    CreateSshCaController,
    DescribeSshCaController,
    RetireSshCaController,
    ListSshPrincipalsController,
    SetSshPrincipalsController,
    CreateSshUserCertificateController,
    CreateSshHostCertificateController,
    ListSshCertificatesController,
    DescribeSshCertificateController,
    RevokeSshCertificateController,
    DescribeMySshController,
  ],
  providers: [
    SshCaService,
    SshPrincipalService,
    SshCertificateService,
    SshKrlService,
  ],
  exports: [SshCaService, SshPrincipalService, SshCertificateService],
})
export class SshModule {}
