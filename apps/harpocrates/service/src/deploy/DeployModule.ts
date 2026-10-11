import { Module } from "@nestjs/common";
import { CertificatesModule } from "../certificates/CertificatesModule";
import { CreateDeployTargetController } from "./controllers/CreateDeployTargetController";
import { DeleteDeployTargetController } from "./controllers/DeleteDeployTargetController";
import { DeployDeployTargetController } from "./controllers/DeployDeployTargetController";
import { DescribeDeployTargetController } from "./controllers/DescribeDeployTargetController";
import { ListDeployTargetsController } from "./controllers/ListDeployTargetsController";
import { UpdateDeployTargetController } from "./controllers/UpdateDeployTargetController";
import { DeployScheduler } from "./services/DeployScheduler";
import { DeployService } from "./services/DeployService";
import { HostPathDeployer } from "./services/HostPathDeployer";

/** Deploy targets (ADR 0020, Renewal and delivery). */
@Module({
  imports: [CertificatesModule],
  controllers: [
    ListDeployTargetsController,
    CreateDeployTargetController,
    DescribeDeployTargetController,
    UpdateDeployTargetController,
    DeployDeployTargetController,
    DeleteDeployTargetController,
  ],
  providers: [DeployService, DeployScheduler, HostPathDeployer],
  exports: [DeployService, DeployScheduler],
})
export class DeployModule {}
