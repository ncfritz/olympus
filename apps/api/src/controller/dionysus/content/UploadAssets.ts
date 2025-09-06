import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { EmptyResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import { Request } from "express";
import { diskStorage } from "multer";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

const destinationDir = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, destination: string) => void,
) => {
  callback(null, process.env.DIONYSUS_UPLOAD_PATH!);
};

@Controller({ version: "1" })
export class UploadAssetsController {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  @Post("/content/upload")
  @ApiOperation({
    summary: "Issues a JWT authorizing black curtain access",
    description: "",
    operationId: "UploadAssets",
    tags: ["Content"],
  })
  @ApiConsumes("multipart/form-data")
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "If authentication was successful.",
    type: () => EmptyResponse,
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
  public async uploadFile(@UploadedFiles() files: Express.Multer.File[]) {
    files.forEach((file) => {
      this.amqpConnection.publish("content.trigger", "jobType.rawIngest", {
        assetLocation: `${process.env.DIONYSUS_PUBLISH_PATH}/${file.filename}`,
        originalFilename: file.originalname,
        skipWorkflow: false,
      });
    });

    return files;
  }
}
