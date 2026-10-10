import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
  ApiSecurity,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import {
  ClientCertificate,
  presentedCertificate,
} from "../../auth/clientCertificate";
import {
  RenewCertificateResponse,
  RenewPresentedCertificateRequest,
} from "../../model/certificates";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { RenewalService } from "../services/RenewalService";

@ApiSecurity("clientCertificate")
@ClientCertificate()
@Controller({ version: "1" })
export class RenewPresentedCertificateController {
  constructor(private readonly renewals: RenewalService) {}

  @Post("/renew")
  @ApiOperation({
    summary: "Renews the presented certificate",
    description:
      "On the renewal listener (9443) only: renews the client certificate the caller presents, with the same subject and profile. Without a CSR the same key is certified again while it is young enough; a CSR for a new key rekeys. The certificate must be one Harpocrates issued, current, not revoked and not already renewed.",
    operationId: "RenewPresentedCertificate",
    tags: ["Renewal"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: RenewPresentedCertificateRequest,
    required: true,
    description: "A CSR, to rekey; `{}` keeps the key.",
  })
  @ApiCreatedResponse({
    description: "The renewal was issued.",
    type: RenewCertificateResponse,
  })
  @ApiStandardErrorResponses({
    exclude: [HttpStatus.NOT_FOUND],
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  })
  async handle(
    @Body() request: RenewPresentedCertificateRequest,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const responseBody: RenewCertificateResponse = {
      certificate: await this.renewals.renewPresented(
        presentedCertificate(httpRequest),
        request,
      ),
    };
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
