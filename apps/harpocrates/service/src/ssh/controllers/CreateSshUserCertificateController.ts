import { Body, Controller, HttpStatus, Post, Req, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiProduces,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { CurrentPrincipal } from "../../auth/currentPrincipal";
import type { AuthenticatedRequest, Principal } from "../../auth/principal";
import { SignedIn } from "../../auth/roles";
import { ConsoleAuthService } from "../../auth/services/ConsoleAuthService";
import {
  CreateSshCertificateResponse,
  CreateSshUserCertificateRequest,
} from "../../model/ssh";
import { ApiStandardErrorResponses } from "../../openapi/controllerDecorators";
import { setLocation } from "../../utils/location";
import { SshCertificateService } from "../services/SshCertificateService";
import { signedInEmail } from "../signedInEmail";
import { DescribeSshCertificateController } from "./DescribeSshCertificateController";

@ApiBearerAuth()
@Controller({ version: "1" })
export class CreateSshUserCertificateController {
  constructor(
    private readonly certificates: SshCertificateService,
    private readonly consoleAuth: ConsoleAuthService,
  ) {}

  @Post("/ssh/certificates/user")
  @ApiOperation({
    summary: "Issues an SSH user certificate",
    description:
      "A user certificate for a public key (ADR 0035): anyone signed in whom a pki-admin has mapped to principals may have one for their own key, carrying those principals or fewer; a pki-admin may issue one for any mapped identity. Valid as long as its profile says (16 hours for ssh-user).",
    operationId: "CreateSshUserCertificate",
    tags: ["SSH"],
  })
  @ApiConsumes("application/json")
  @ApiProduces("application/json")
  @ApiBody({
    type: CreateSshUserCertificateRequest,
    required: true,
    description:
      "The key, and the principals and identity if not the defaults.",
  })
  @ApiCreatedResponse({
    description: "The certificate was issued.",
    type: CreateSshCertificateResponse,
    headers: {
      Location: { schema: { type: "string" }, description: "The certificate" },
    },
  })
  @ApiStandardErrorResponses({
    include: [
      HttpStatus.FORBIDDEN,
      HttpStatus.CONFLICT,
      HttpStatus.UNPROCESSABLE_ENTITY,
      HttpStatus.SERVICE_UNAVAILABLE,
    ],
  })
  @SignedIn()
  async handle(
    @Body() request: CreateSshUserCertificateRequest,
    @CurrentPrincipal() principal: Principal,
    @Req() httpRequest: Request,
    @Res() response: Response,
  ): Promise<void> {
    const email = await signedInEmail(
      this.consoleAuth,
      principal,
      (httpRequest as AuthenticatedRequest).accessToken,
    );
    const responseBody: CreateSshCertificateResponse = {
      certificate: await this.certificates.issueUser(principal, email, request),
    };
    setLocation(response, httpRequest, DescribeSshCertificateController, {
      certificateId: responseBody.certificate.id,
    });
    response.status(HttpStatus.CREATED).send(responseBody);
  }
}
