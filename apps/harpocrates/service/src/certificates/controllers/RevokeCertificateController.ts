import {
  Body,
  Controller,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from "@nestjs/common";
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
  RevokeCertificateRequest,
  RevokeCertificateResponse,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { CertificateService } from "../services/CertificateService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class RevokeCertificateController {
  constructor(private readonly certificates: CertificateService) {}

  @Post("/certificate/:certificateId/revoke")
  @ApiOperation({
    summary: "Revokes a certificate",
    description:
      "Revokes a certificate with a reason. For keyCompromise the key is blocked for good and every certificate for it is revoked; an escrowed key is destroyed with its last valid certificate.",
    operationId: "RevokeCertificate",
    tags: ["Certificates"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiParam({
    name: "certificateId",
    description: "The certificate to revoke",
    type: String,
  })
  @ApiBody({
    type: RevokeCertificateRequest,
    required: true,
    description: "The reason and a comment.",
  })
  @ApiOkResponse({
    description: "The certificates were revoked.",
    type: RevokeCertificateResponse,
  })
  @ApiStandardErrorResponses({
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  })
  @AnyPkiRole()
  async handle(
    @Param("certificateId", ParseUUIDPipe) certificateId: string,
    @Body() request: RevokeCertificateRequest,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: RevokeCertificateResponse = {
      certificates: await this.certificates.revoke(
        principal,
        certificateId,
        request,
      ),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
