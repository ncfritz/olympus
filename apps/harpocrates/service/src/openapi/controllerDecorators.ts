import { applyDecorators, HttpStatus } from "@nestjs/common";
import { ApiResponse } from "@nestjs/swagger";
import { ErrorResponse } from "./ErrorResponse";

const ERROR_DESCRIPTIONS: { [K in HttpStatus]?: string } = {
  [HttpStatus.BAD_REQUEST]: "The request presented was not valid",
  [HttpStatus.UNAUTHORIZED]: "No valid access token was presented",
  [HttpStatus.NOT_FOUND]:
    "The entity with the specified identifiers was not found",
};

/** Answers only some operations give, added with `include`. */
const OPTIONAL_ERROR_DESCRIPTIONS: { [K in HttpStatus]?: string } = {
  [HttpStatus.FORBIDDEN]:
    "The caller's roles do not allow it, it needs a more recent sign-in, or a change riding on the console's cookies came from another page",
  [HttpStatus.CONFLICT]: "The request conflicts with the current state",
  [HttpStatus.UNPROCESSABLE_ENTITY]:
    "Refused: a profile rule or one of the signer's invariants",
  [HttpStatus.SERVICE_UNAVAILABLE]:
    "The signer is sealed or unreachable, or the Olympus API cannot be asked",
};

export type ApiStandardErrorResponsesOptions = {
  exclude?: HttpStatus[];
  include?: HttpStatus[];
};

/**
 * The error answers every management operation documents (as the Olympus
 * API's decorator of the same name, plus 401 for the access token).
 */
export const ApiStandardErrorResponses = (
  options?: ApiStandardErrorResponsesOptions,
) =>
  applyDecorators(
    ...Object.entries({
      ...ERROR_DESCRIPTIONS,
      ...Object.fromEntries(
        Object.entries(OPTIONAL_ERROR_DESCRIPTIONS).filter(([status]) =>
          options?.include?.includes(Number(status)),
        ),
      ),
    })
      .filter(([status]) => !options?.exclude?.includes(Number(status)))
      .map(([status, description]) =>
        ApiResponse({
          status: Number(status),
          description,
          type: () => ErrorResponse,
        }),
      ),
  );
