import { Module } from "@nestjs/common";
import { RabbitModule } from "./RabbitModule";
import { SendAmqpTestMessageController } from "../controller/SendAmqpTestMessageController";
import { PingController } from "../controller/PingController";

@Module({
  imports: [RabbitModule],
  exports: [],
  providers: [],
  controllers: [PingController, SendAmqpTestMessageController],
})
export class AdminApiModule {}
