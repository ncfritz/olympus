import { EmptyResponse } from "@ncfritz/olympus-model";
import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { Response } from "express";
import * as speakeasy from "speakeasy";
import { ApiStandardErrorResponses } from "../../../utils/controllerDecorators";

@Controller({ version: "1" })
export class GenerateAuthKeyController {
  @Get("/content/auth/secret")
  @ApiOperation({
    summary: "Issues a JWT authorizing black curtain access",
    description: "",
    operationId: "GenerateAuthKey",
    tags: ["Content"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "If authentication was successful.",
    type: () => EmptyResponse,
  })
  @ApiStandardErrorResponses()
  async handle(@Res() response: Response): Promise<void> {
    const secret = speakeasy.generateSecret();

    response.status(HttpStatus.OK).send(secret);
  }
}
