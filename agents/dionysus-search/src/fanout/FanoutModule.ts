import { Module } from "@nestjs/common";
import { RabbitModule } from "../infra/RabbitModule";
import { SearchConfigurationFanoutHandler } from "./handlers/SearchConfigurationFanoutHandler";

/** The periodic fanout that triggers due search configurations. */
@Module({
  // Publishes searches.
  imports: [RabbitModule],
  providers: [SearchConfigurationFanoutHandler],
})
export class FanoutModule {}
