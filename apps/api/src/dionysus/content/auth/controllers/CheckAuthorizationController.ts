import { CheckAuthResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response, type Request } from "express";
import { contentAuthToken } from "../contentAuth";
import { ContentAuthService } from "../services/ContentAuthService";
import { ApiStandardErrorResponses } from "../../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class CheckAuthorizationController {
  constructor(private readonly contentAuth: ContentAuthService) {}

  @Get("/content/auth/status")
  @ApiOperation({
    summary: "Checks whether the caller has black curtain access",
    description:
      "Checks the x-dionysus-content-auth cookie and reports whether it holds a valid black curtain token issued in the last 30 minutes.",
    operationId: "CheckAuthorization",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "If authentication was successful.",
    type: () => CheckAuthResponse,
  })
  @ApiStandardErrorResponses()
  async handle(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (
      !(await this.contentAuth.checkAuthorization(contentAuthToken(request)))
    ) {
      response.status(HttpStatus.UNAUTHORIZED).send({ authorized: false });
      return;
    }

    const responseBody: CheckAuthResponse = { authorized: true };

    response.status(HttpStatus.OK).send(responseBody);
  }
}
