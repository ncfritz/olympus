import { UploadAssetsResponse } from "@ncfritz/olympus-model";
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
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";
import { ContentIngestionWorkflowService } from "../services/ContentIngestionWorkflowService";

@Controller({ version: "1" })
export class UploadAssetsController {
  constructor(
    private readonly contentIngestionWorkflows: ContentIngestionWorkflowService,
  ) {}

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
  @UseInterceptors(FilesInterceptor("files"))
  async handle(
    @UploadedFiles() files: Express.Multer.File[],
    @Res() response: Response,
  ): Promise<void> {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files were uploaded");
    }

    const workflows = await this.contentIngestionWorkflows.createForUploads(
      files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
      })),
    );

    const responseBody: UploadAssetsResponse = { workflows };

    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
