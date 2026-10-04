import { Module } from "@nestjs/common";
import { GraphQLClientModule } from "../../infra/GraphQLClientModule";
import { CalendarsModule } from "../calendars/CalendarsModule";
import { ClearMeetingAvailabilityController } from "./controllers/ClearMeetingAvailabilityController";
import { CreateAvailabilityBlockController } from "./controllers/CreateAvailabilityBlockController";
import { DeleteAvailabilityBlockController } from "./controllers/DeleteAvailabilityBlockController";
import { DescribeAvailabilityBlockController } from "./controllers/DescribeAvailabilityBlockController";
import { GetAvailabilityController } from "./controllers/GetAvailabilityController";
import { ListAvailabilityBlocksController } from "./controllers/ListAvailabilityBlocksController";
import { SetMeetingAvailabilityController } from "./controllers/SetMeetingAvailabilityController";
import { UpdateAvailabilityBlockController } from "./controllers/UpdateAvailabilityBlockController";
import { AvailabilityService } from "./services/AvailabilityService";

/**
 * A user's availability (ADR 0029): worked out from their own meetings,
 * with the blocks and meeting levels they set on top.
 */
@Module({
  imports: [GraphQLClientModule, CalendarsModule],
  controllers: [
    GetAvailabilityController,
    ListAvailabilityBlocksController,
    CreateAvailabilityBlockController,
    DescribeAvailabilityBlockController,
    UpdateAvailabilityBlockController,
    DeleteAvailabilityBlockController,
    SetMeetingAvailabilityController,
    ClearMeetingAvailabilityController,
  ],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
