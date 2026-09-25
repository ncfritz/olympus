import { DescribeJsonWebKeySetResponse } from "@ncfritz/olympus-model";
import {
  Controller,
  Get,
  HttpStatus,
  Res,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProduces } from "@nestjs/swagger";
import { type Response } from "express";
import { ApiStandardErrorResponses } from "../../utils/controllerDecorators";
import { Public } from "../authDecorators";
import { SigningKeyService } from "../tokens/SigningKeyService";

/**
 * The public half of the access-token signing keys.
 *
 * Version-neutral and outside every module prefix, because the path is
 * fixed by convention: a client looking for a key set looks at
 * /.well-known/jwks.json and nowhere else. Publishing it through nginx is
 * a location of its own, added when something outside the API needs it.
 */
@Controller({ path: ".well-known", version: VERSION_NEUTRAL })
export class DescribeJsonWebKeySetController {
  constructor(private readonly keys: SigningKeyService) {}

  @Get("/jwks.json")
  @Public()
  @ApiOperation({
    summary: "The keys that verify the API's access tokens",
    description:
      "Every key the API currently verifies access tokens with, as a JSON Web Key Set. An access token's `kid` header names which one signed it, so a token issued before a rotation still verifies. Empty where signing in is not configured.",
    operationId: "DescribeJsonWebKeySet",
    tags: ["Authentication"],
  })
  @ApiProduces("application/json")
  @ApiOkResponse({
    description: "The key set.",
    type: () => DescribeJsonWebKeySetResponse,
  })
  @ApiStandardErrorResponses()
  handle(@Res() response: Response): void {
    const keys = this.keys.available();
    const body: DescribeJsonWebKeySetResponse = {
      keys: (keys?.jwks.keys ?? []) as DescribeJsonWebKeySetResponse["keys"],
    };
    response
      // A key set is cacheable, but not for long: a rotation has to reach
      // verifiers before the old key stops signing.
      .set("Cache-Control", "public, max-age=300")
      .status(HttpStatus.OK)
      .send(body);
  }
}
