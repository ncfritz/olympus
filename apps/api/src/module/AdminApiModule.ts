import { Module } from "@nestjs/common";
import { RabbitModule } from "./RabbitModule";
import { SendAmqpTestMessageController } from "../controller/SendAmqpTestMessage";
import { PingController } from "../controller/Ping";

@Module({
  imports: [RabbitModule],
  exports: [],
  providers: [],
  controllers: [PingController, SendAmqpTestMessageController],
})
export class AdminApiModule {}
