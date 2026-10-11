import { Controller, HttpStatus, Param, Post, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { Principal } from "../../auth/principal";
import { AdminOnly } from "../../auth/roles";
import { RevokeAcmeCredentialResponse } from "../../model/acme";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { AcmeCredentialService } from "../services/AcmeCredentialService";

@ApiBearerAuth()
@Controller({ version: "1" })
export class RevokeAcmeCredentialController {
  constructor(private readonly credentials: AcmeCredentialService) {}

  @Post("/acme/credential/:credentialId/revoke")
  @ApiOperation({
    summary: "Revokes an ACME credential",
    description:
      "Revokes an External Account Binding credential: unused, it can no longer register an account; bound, its account is revoked and can order nothing more. Certificates it was issued stay valid until revoked themselves.",
    operationId: "RevokeAcmeCredential",
    tags: ["ACME Credentials"],
  })
  @ApiProduces("application/json")
  @ApiParam({
    name: "credentialId",
    description: "The credential's key id",
    type: String,
  })
  @ApiOkResponse({
    description: "The credential, revoked.",
    type: RevokeAcmeCredentialResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.BAD_REQUEST],
    include: [HttpStatus.FORBIDDEN, HttpStatus.CONFLICT],
  })
  @AdminOnly()
  async handle(
    @Param("credentialId") credentialId: string,
    @CurrentPrincipal() principal: Principal,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: RevokeAcmeCredentialResponse = {
      credential: await this.credentials.revoke(principal, credentialId),
    };
    response.status(HttpStatus.OK).send(responseBody);
  }
}
