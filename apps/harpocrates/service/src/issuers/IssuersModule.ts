import { Module } from "@nestjs/common";
import { DiscardIssuerController } from "./controllers/DiscardIssuerController";
import { CreateRootIssuerController } from "./controllers/CreateRootIssuerController";
import { DescribeIssuerController } from "./controllers/DescribeIssuerController";
import { ImportIssuerController } from "./controllers/ImportIssuerController";
import { ListIssuersController } from "./controllers/ListIssuersController";
import { IssuerService } from "./services/IssuerService";

@Module({
  controllers: [
    ListIssuersController,
    CreateRootIssuerController,
    ImportIssuerController,
    DescribeIssuerController,
    DiscardIssuerController,
  ],
  providers: [IssuerService],
  exports: [IssuerService],
})
export class IssuersModule {}
