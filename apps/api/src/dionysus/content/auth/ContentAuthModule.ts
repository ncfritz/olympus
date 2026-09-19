import { Module } from "@nestjs/common";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CheckAuthorizationController } from "./controllers/CheckAuthorizationController";
import { GenerateAuthKeyController } from "./controllers/GenerateAuthKeyController";
import { VerifyAuthCodeController } from "./controllers/VerifyAuthCodeController";
import { ContentAuthService } from "./services/ContentAuthService";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [ContentAuthService],
  exports: [ContentAuthService],
  controllers: [
    CheckAuthorizationController,
    GenerateAuthKeyController,
    VerifyAuthCodeController,
  ],
})
export class ContentAuthModule {}
