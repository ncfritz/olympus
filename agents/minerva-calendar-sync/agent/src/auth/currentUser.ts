import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { AuthenticatedRequest, AuthUser } from "./authUser";

/**
 * The verified person attached by JwtAuthGuard. Only usable on routes it
 * actually guards; a service caller has no user, and is refused.
 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    const caller = ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (caller.kind !== "user") {
      throw new ForbiddenException("A service has no signed-in user");
    }
    return caller;
  },
);
