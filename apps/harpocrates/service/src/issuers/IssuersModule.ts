import { Module } from "@nestjs/common";
import { DiscardIssuerController } from "./controllers/DiscardIssuerController";
import { CreateRootIssuerController } from "./controllers/CreateRootIssuerController";
import { CountIssuedController } from "./controllers/CountIssuedController";
import { DescribeIssuerController } from "./controllers/DescribeIssuerController";
import { ImportIssuerController } from "./controllers/ImportIssuerController";
import { ListIssuersController } from "./controllers/ListIssuersController";
import { PreviewIssuerController } from "./controllers/PreviewIssuerController";
import { IssuerPreviewService } from "./services/IssuerPreviewService";
import { IssuerService } from "./services/IssuerService";

@Module({
  controllers: [
    ListIssuersController,
    CreateRootIssuerController,
    ImportIssuerController,
    CountIssuedController,
    DescribeIssuerController,
    DiscardIssuerController,
    PreviewIssuerController,
  ],
  providers: [IssuerService, IssuerPreviewService],
  exports: [IssuerService],
})
export class IssuersModule {}
