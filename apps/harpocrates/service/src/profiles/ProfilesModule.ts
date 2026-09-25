import { Module } from "@nestjs/common";
import { DescribeProfileController } from "./controllers/DescribeProfileController";
import { ListProfilesController } from "./controllers/ListProfilesController";
import { UpdateProfileController } from "./controllers/UpdateProfileController";
import { ProfileService } from "./services/ProfileService";

@Module({
  controllers: [
    ListProfilesController,
    DescribeProfileController,
    UpdateProfileController,
  ],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfilesModule {}
