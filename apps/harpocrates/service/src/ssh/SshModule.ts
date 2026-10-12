import { Module } from "@nestjs/common";
import { KeysModule } from "../keys/KeysModule";
import { CreateSshCaController } from "./controllers/CreateSshCaController";
import { DescribeSshCaController } from "./controllers/DescribeSshCaController";
import { ListSshCasController } from "./controllers/ListSshCasController";
import { ListSshPrincipalsController } from "./controllers/ListSshPrincipalsController";
import { RetireSshCaController } from "./controllers/RetireSshCaController";
import { SetSshPrincipalsController } from "./controllers/SetSshPrincipalsController";
import { SshCaService } from "./services/SshCaService";
import { SshPrincipalService } from "./services/SshPrincipalService";

/** SSH CAs and who may log in as whom (ADR 0035). */
@Module({
  imports: [KeysModule],
  controllers: [
    ListSshCasController,
    CreateSshCaController,
    DescribeSshCaController,
    RetireSshCaController,
    ListSshPrincipalsController,
    SetSshPrincipalsController,
  ],
  providers: [SshCaService, SshPrincipalService],
  exports: [SshCaService, SshPrincipalService],
})
export class SshModule {}
