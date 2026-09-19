import { Module } from "@nestjs/common";
import { RabbitModule } from "../../infra/RabbitModule";
import { PingController } from "./controllers/PingController";
import { SendAmqpTestMessageController } from "./controllers/SendAmqpTestMessageController";

@Module({
  imports: [RabbitModule],
  controllers: [PingController, SendAmqpTestMessageController],
})
export class AdminModule {}
