import { Module } from "@nestjs/common";
import { CertificationService } from "./services/CertificationService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreateCertificationController } from "./controllers/CreateCertificationController";
import { ListCertificationsController } from "./controllers/ListCertificationsController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [CertificationService],
  controllers: [CreateCertificationController, ListCertificationsController],
})
export class CertificationsModule {}
