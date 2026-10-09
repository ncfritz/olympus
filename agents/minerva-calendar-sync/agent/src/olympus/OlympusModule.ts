import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/AuthModule";
import { ForwardToOlympusController } from "./controllers/ForwardToOlympusController";
import { OlympusForwardingService } from "./services/OlympusForwardingService";

/** The console's calls on the Olympus API, made through the agent (ADR 0029). */
@Module({
  imports: [AuthModule],
  controllers: [ForwardToOlympusController],
  providers: [OlympusForwardingService],
})
export class OlympusModule {}
