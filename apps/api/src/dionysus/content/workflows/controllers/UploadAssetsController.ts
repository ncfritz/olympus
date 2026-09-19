import { randomBytes } from "node:crypto";
import * as path from "node:path";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import {
  ContentIngestionWorkflow,
  ContentIngestionWorkflowAssetLocation,
  UploadAssetsResponse,
} from "@ncfritz/olympus-model";
import {
  BadRequestException,
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

/**
 * `<random>-<name>` where name is the client's file name reduced to a safe
 * base name, so an upload cannot be written outside the upload directory.
 */
export const storedFilename = (originalName: string): string => {
  const base = path
    .basename(originalName.replace(/\\/g, "/"))
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/^\.+/, "_");
  return `${randomBytes(16).toString("hex")}-${base || "upload"}`;
};

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
          cb(null, storedFilename(file.originalname));
        },
      }),
    }),
  )
  async handle(
    @UploadedFiles() files: Express.Multer.File[],
    @Res() response: Response,
  ): Promise<void> {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files were uploaded");
    }

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
