import { InjectGraphQLClient } from "@golevelup/nestjs-graphql-request";
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
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { GraphQLClient } from "graphql-request";
import { diskStorage } from "multer";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";

const destinationDir = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, destination: string) => void,
) => {
  callback(null, process.env.DIONYSUS_UPLOAD_PATH!);
};

@Controller()
export class UploadAssetsController {
  constructor(
    @InjectGraphQLClient() private readonly graphQLClient: GraphQLClient,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @Post("/v1/content/upload")
  @ApiOperation({
    summary: "Issues a JWT authorizing black curtain access",
    description: "",
    operationId: "UploadAssets",
  })
  @ApiTags("Content")
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
    this.graphQLClient !== null;

    files.forEach((file) => {
      console.log(file);

      this.amqpConnection.publish("content.trigger", "jobType.rawIngest", {
        assetLocation: `/dionysus/downloads/${file.originalname}`,
        skipWorkflow: false,
      });
    });

    return files;
  }
}
