import { Module } from "@nestjs/common";
import { CopyProfileController } from "./controllers/CopyProfileController";
import { CreateProfileController } from "./controllers/CreateProfileController";
import { DeactivateProfileController } from "./controllers/DeactivateProfileController";
import { DescribeProfileController } from "./controllers/DescribeProfileController";
import { ListProfilesController } from "./controllers/ListProfilesController";
import { ListProfileVersionsController } from "./controllers/ListProfileVersionsController";
import { MoveProfileEnrollmentsController } from "./controllers/MoveProfileEnrollmentsController";
import { ReactivateProfileController } from "./controllers/ReactivateProfileController";
import { UpdateProfileController } from "./controllers/UpdateProfileController";
import { ProfileService } from "./services/ProfileService";

@Module({
  controllers: [
    ListProfilesController,
    CreateProfileController,
    DescribeProfileController,
    UpdateProfileController,
    ListProfileVersionsController,
    CopyProfileController,
    DeactivateProfileController,
    ReactivateProfileController,
    MoveProfileEnrollmentsController,
  ],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfilesModule {}
