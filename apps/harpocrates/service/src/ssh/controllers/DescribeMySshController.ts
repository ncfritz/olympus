import { Controller, Get, HttpStatus, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { AuthenticatedRequest, Principal } from "../../auth/principal";
import { SignedIn } from "../../auth/roles";
import { ConsoleAuthService } from "../../auth/services/ConsoleAuthService";
import { DescribeMySshResponse } from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshCertificateService } from "../services/SshCertificateService";
import { signedInEmail } from "../signedInEmail";

@ApiBearerAuth()
@Controller({ version: "1" })
export class DescribeMySshController {
  constructor(
    private readonly certificates: SshCertificateService,
    private readonly consoleAuth: ConsoleAuthService,
  ) {}

  @Get("/ssh/mine")
  @ApiOperation({
    summary: "Describes one's own SSH access",
    description:
      "The signed-in identity, the principals it is mapped to, and its user certificates. Anyone signed in may ask.",
    operationId: "DescribeMySsh",
    tags: ["SSH"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "One's SSH access.",
    type: DescribeMySshResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND],
    include: [HttpStatus.SERVICE_UNAVAILABLE],
  })
  @SignedIn()
  async handle(
    @CurrentPrincipal() principal: Principal,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    const email = await signedInEmail(
      this.consoleAuth,
      principal,
      request.accessToken,
    );
    const responseBody: DescribeMySshResponse = await this.certificates.mine(
      email ?? "",
    );
    response.status(HttpStatus.OK).send(responseBody);
  }
}
