import { Module } from "@nestjs/common";
import { StoreModule } from "../store/store.module";
import { OverridesController } from "./overrides.controller";

@Module({
  imports: [StoreModule],
  controllers: [OverridesController],
})
export class OverridesModule {}
