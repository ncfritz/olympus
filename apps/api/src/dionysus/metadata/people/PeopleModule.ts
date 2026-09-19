import { Module } from "@nestjs/common";
import { PersonService } from "./services/PersonService";
import { RabbitModule } from "../../../infra/RabbitModule";
import { GraphQLClientModule } from "../../../infra/GraphQLClientModule";
import { CreatePersonController } from "./controllers/CreatePersonController";
import { DescribePersonController } from "./controllers/DescribePersonController";
import { GetPeopleBirthdayStatisticsController } from "./controllers/GetPeopleBirthdayStatisticsController";
import { GetPeopleDeathdayStatisticsController } from "./controllers/GetPeopleDeathdayStatisticsController";
import { GetPeopleDepartmentStatisticsController } from "./controllers/GetPeopleDepartmentStatisticsController";
import { ListMovieCastRolesForPersonController } from "./controllers/ListMovieCastRolesForPersonController";
import { ListMovieCrewJobsForPersonController } from "./controllers/ListMovieCrewJobsForPersonController";
import { ListPeopleController } from "./controllers/ListPeopleController";

@Module({
  imports: [RabbitModule, GraphQLClientModule],
  providers: [PersonService],
  controllers: [
    CreatePersonController,
    DescribePersonController,
    GetPeopleBirthdayStatisticsController,
    GetPeopleDeathdayStatisticsController,
    GetPeopleDepartmentStatisticsController,
    ListMovieCastRolesForPersonController,
    ListMovieCrewJobsForPersonController,
    ListPeopleController,
  ],
})
export class PeopleModule {}
