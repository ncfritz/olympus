import { SortDirection } from "@ncfritz/olympus-model";
import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
} from "@nestjs/common";
import { ApiQuery, ApiResponse } from "@nestjs/swagger";
import { IncomingMessage } from "connect";
import { ErrorResponse } from "../types/error";

const ERROR_DESCRIPTIONS: { [K in HttpStatus]?: string } = {
  [HttpStatus.BAD_REQUEST]: "The request presented was not valid",
  [HttpStatus.NOT_FOUND]:
    "The entity with the specified identifiers was not found",
};

export type ApiStandardErrorResponsesOptions = {
  exclude?: HttpStatus[];
};

export function ApiStandardErrorResponses(
  options?: ApiStandardErrorResponsesOptions,
) {
  const apiResponses: (typeof ApiResponse)[] = [];

  for (const key in ERROR_DESCRIPTIONS) {
    if (!options || !options.exclude || key in options.exclude) {
      apiResponses.push(
        ApiResponse({
          status: key as unknown as number,
          description: ERROR_DESCRIPTIONS[key as unknown as HttpStatus],
          type: () => ErrorResponse,
        }),
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  return applyDecorators(...apiResponses);
}

export function ApiPaginationParams() {
  return applyDecorators(
    ApiQuery({
      name: "sort",
      description: "The sort order to apply to the results",
      enum: SortDirection,
      required: false,
    }),
    ApiQuery({
      name: "sortBy",
      description: "The field to sort on",
      type: String,
      required: false,
    }),
    ApiQuery({
      name: "pageSize",
      description: "The number of results to return per page",
      type: Number,
      required: false,
    }),
    ApiQuery({
      name: "startPage",
      description: "The results page to start from",
      type: Number,
      required: false,
    }),
  );
}

export const Header = createParamDecorator(
  (name: string, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest<IncomingMessage>();
    const { headers } = req;

    return headers[name] as string;
  },
);

export const HeaderTimezone = createParamDecorator(
  (_: never, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<IncomingMessage>();
    const tz = req.headers["x-ncfritz-tz"];

    return (tz as string) || "Etc/UTC";
  },
);
