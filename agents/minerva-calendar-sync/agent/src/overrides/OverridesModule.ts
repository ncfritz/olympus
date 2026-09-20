import { Module } from "@nestjs/common";
import { StoreModule } from "../store/StoreModule";
import { CreateOverrideBlockController } from "./controllers/CreateOverrideBlockController";
import { DeleteOverrideBlockController } from "./controllers/DeleteOverrideBlockController";
import { ListOverrideBlocksController } from "./controllers/ListOverrideBlocksController";
import { UpdateOverrideBlockController } from "./controllers/UpdateOverrideBlockController";
import { OverrideBlockService } from "./services/OverrideBlockService";

@Module({
  imports: [StoreModule],
  controllers: [
    CreateOverrideBlockController,
    ListOverrideBlocksController,
    UpdateOverrideBlockController,
    DeleteOverrideBlockController,
  ],
  providers: [OverrideBlockService],
})
export class OverridesModule {}
