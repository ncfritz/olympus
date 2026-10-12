import { Body, Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AnyPkiRole } from "../../auth/roles";
import {
  RevokeSshCertificateRequest,
  RevokeSshCertificateResponse,
} from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { SshCertificateService } from "../services/SshCertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class RevokeSshCertificateController {
  constructor(private readonly certificates: SshCertificateService) {}

  @Post("/ssh/certificate/:certificateId/revoke")
  @ApiOperation({
    summary: "Revokes an SSH certificate",
    description:
      "Revokes it and writes its CA's KRL at once (ADR 0035); hosts refuse it once they fetch the KRL. keyCompromise also blocks the key for good and revokes its other SSH certificates.",
    operationId: "RevokeSshCertificate",
    tags: ["SSH"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "certificateId",
    description: "The certificate's id",
    type: String,
  })
  @ApiBody({
    type: RevokeSshCertificateRequest,
    required: true,
    description: "Why.",
  })
  @ApiOkResponse({
    description: "The certificate, revoked.",
    type: RevokeSshCertificateResponse,
  })
  @ApiStandardErrorResponses({
    include: [HttpStatus.FORBIDDEN, HttpStatus.CONFLICT],
  })
  @AnyPkiRole()
  async handle(
    @Param("certificateId") certificateId: string,
    @Body() request: RevokeSshCertificateRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: RevokeSshCertificateResponse = {
      certificate: await this.certificates.revoke(
        principal,
        certificateId,
        request.reason,
        request.comment,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
