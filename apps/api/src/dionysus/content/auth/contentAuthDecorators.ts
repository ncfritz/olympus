import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  UseGuards,
} from "@nestjs/common";
import {
  ContentAuthGuard,
  RequestWithCurtain,
  RequireContentAuth,
} from "./ContentAuthGuard";
import { ContentCurtain } from "./ContentCurtain";

/**
 * Runs ContentAuthGuard on the route. With `required`, requests without
 * valid content auth are rejected with 401; otherwise they are served
 * behind the black curtain (see @Curtain()).
 */
export const ContentAuth = ({
  required = false,
}: { required?: boolean } = {}) =>
  required
    ? applyDecorators(RequireContentAuth(), UseGuards(ContentAuthGuard))
    : applyDecorators(UseGuards(ContentAuthGuard));

/** The request's ContentCurtain. The route needs @ContentAuth(). */
export const Curtain = createParamDecorator(
  (_: unknown, context: ExecutionContext): ContentCurtain => {
    const curtain = context
      .switchToHttp()
      .getRequest<RequestWithCurtain>().contentCurtain;
    if (!curtain) {
      throw new Error("@Curtain() used on a route without @ContentAuth()");
    }
    return curtain;
  },
);
