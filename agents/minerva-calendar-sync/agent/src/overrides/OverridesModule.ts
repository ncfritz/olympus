import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { OverridesController } from "./controllers/OverridesController";

@Module({
  imports: [StoreModule],
  controllers: [OverridesController],
})
export class OverridesModule {}
