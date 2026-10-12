import { Module } from "@nestjs/common";
import { KeysModule } from "../keys/KeysModule";
import { ProfilesModule } from "../profiles/ProfilesModule";
import { CreateSshHostCertificateController } from "./controllers/CreateSshHostCertificateController";
import { CreateSshRenewalChallengeController } from "./controllers/CreateSshRenewalChallengeController";
import { CreateSshUserCertificateController } from "./controllers/CreateSshUserCertificateController";
import { DescribeMySshController } from "./controllers/DescribeMySshController";
import { DescribeSshTypeKrlController } from "./controllers/DescribeSshTypeKrlController";
import { DescribeSshCertificateController } from "./controllers/DescribeSshCertificateController";
import { ListSshCertificatesController } from "./controllers/ListSshCertificatesController";
import { RenewSshHostCertificateController } from "./controllers/RenewSshHostCertificateController";
import { RevokeSshCertificateController } from "./controllers/RevokeSshCertificateController";
import { CreateSshCaController } from "./controllers/CreateSshCaController";
import { DescribeSshCaController } from "./controllers/DescribeSshCaController";
import { ListSshCasController } from "./controllers/ListSshCasController";
import { ListSshPrincipalsController } from "./controllers/ListSshPrincipalsController";
import { RetireSshCaController } from "./controllers/RetireSshCaController";
import { SetSshPrincipalsController } from "./controllers/SetSshPrincipalsController";
import { SshCaService } from "./services/SshCaService";
import { SshCertificateService } from "./services/SshCertificateService";
import { SshHostRenewalService } from "./services/SshHostRenewalService";
import { SshKrlService } from "./services/SshKrlService";
import { SshPrincipalService } from "./services/SshPrincipalService";

/**
 * SSH CAs, who may log in as whom, SSH certificates, their KRLs and
 * hosts' renewal (ADR 0035).
 */
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
    CreateSshRenewalChallengeController,
    RenewSshHostCertificateController,
    DescribeSshTypeKrlController,
  ],
  providers: [
    SshCaService,
    SshPrincipalService,
    SshCertificateService,
    SshKrlService,
    SshHostRenewalService,
  ],
  exports: [SshCaService, SshPrincipalService, SshCertificateService],
})
export class SshModule {}
