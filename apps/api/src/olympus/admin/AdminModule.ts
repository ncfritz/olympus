import { Module } from "@nestjs/common";
import { RabbitModule } from "../../infra/RabbitModule";
import { PingController } from "./controllers/PingController";
import { SendAmqpTestMessageController } from "./controllers/SendAmqpTestMessageController";
import { TestMessageService } from "./services/TestMessageService";

@Module({
  imports: [RabbitModule],
  providers: [TestMessageService],
  controllers: [PingController, SendAmqpTestMessageController],
})
export class AdminModule {}
