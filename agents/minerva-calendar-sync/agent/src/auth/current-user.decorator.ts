import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedRequest, AuthUser } from "./auth-user";

/** The verified user attached by JwtAuthGuard. Only usable on routes it actually guards. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});
