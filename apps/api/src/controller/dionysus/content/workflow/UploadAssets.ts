import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  ContentIngestionWorkflow,
  ContentIngestionWorkflowAssetLocation,
  UploadAssetsResponse,
} from "@ncfritz/olympus-model";
import {
  Controller,
  HttpStatus,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { type Request, type Response } from "express";
import { GraphQLClient } from "graphql-request";
import { diskStorage } from "multer";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { BaseContentIngestionWorkflowController } from "./BaseContentIngestionWorkflowController";

const destinationDir = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, destination: string) => void,
) => {
  callback(null, process.env.DIONYSUS_UPLOAD_PATH!);
};

@Controller({ version: "1" })
export class UploadAssetsController extends BaseContentIngestionWorkflowController {
  constructor(
    protected readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {
    super(graphQLClient);
  }

  @Post("/content/upload")
  @ApiOperation({
    summary: "Uploads content assets for ingestion",
    description:
      "Accepts one or more files as multipart form data, stores them in the upload directory and starts a content ingestion workflow for each.",
    operationId: "UploadAssets",
    tags: ["Content"],
  })
  @ApiConsumes("multipart/form-data")
  @ApiProduces("application/json")
  @ApiCreatedResponse({
    description:
      "The files were stored and an ingestion workflow was started for each.",
    type: () => UploadAssetsResponse,
  })
  @ApiStandardErrorResponses()
  @UseInterceptors(
    FilesInterceptor("files", undefined, {
      storage: diskStorage({
        destination: destinationDir,
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join("");
          cb(null, `${randomName}-${file.originalname}`);
        },
      }),
    }),
  )
  async handle(
    @UploadedFiles() files: Express.Multer.File[],
    @Res() response: Response,
  ): Promise<void> {
    const workflows: ContentIngestionWorkflow[] = [];

    for (const file of files) {
      const workflow = await this.createContentIngestionWorkflow(
        file.originalname,
        ContentIngestionWorkflowAssetLocation.LOCAL,
      );
      await this.amqpConnection.publish(
        "content.trigger",
        "jobType.rawIngest",
        {
          workflowId: workflow.id,
          assetLocation: `${process.env.DIONYSUS_PUBLISH_PATH}/${file.filename}`,
          originalFilename: file.originalname,
          skipWorkflow: false,
        },
      );
      workflows.push(workflow);
    }

    const responseBody: UploadAssetsResponse = { workflows };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
