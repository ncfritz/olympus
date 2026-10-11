import { Module } from "@nestjs/common";
import { CertificatesModule } from "../certificates/CertificatesModule";
import { CheckDeployTargetController } from "./controllers/CheckDeployTargetController";
import { CreateDeployTargetController } from "./controllers/CreateDeployTargetController";
import { DeleteDeployTargetController } from "./controllers/DeleteDeployTargetController";
import { DeployDeployTargetController } from "./controllers/DeployDeployTargetController";
import { DescribeDeployTargetController } from "./controllers/DescribeDeployTargetController";
import { ListDeployTargetsController } from "./controllers/ListDeployTargetsController";
import { UpdateDeployTargetController } from "./controllers/UpdateDeployTargetController";
import { DeployScheduler } from "./services/DeployScheduler";
import { DeployService } from "./services/DeployService";
import { EndpointCheckService } from "./services/EndpointCheckService";
import { EndpointProbe } from "./services/EndpointProbe";
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
    CheckDeployTargetController,
    DeleteDeployTargetController,
  ],
  providers: [
    DeployService,
    DeployScheduler,
    HostPathDeployer,
    EndpointCheckService,
    EndpointProbe,
  ],
  exports: [DeployService, DeployScheduler],
})
export class DeployModule {}
