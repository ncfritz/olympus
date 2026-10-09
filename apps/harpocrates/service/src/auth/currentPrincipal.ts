import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { AuthenticatedRequest, Principal } from "./principal";

/** The verified principal attached by AuthGuard. */
export const CurrentPrincipal = createParamDecorator(
  (_: unknown, context: ExecutionContext): Principal => {
    const principal = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().principal;
    if (!principal) throw new UnauthorizedException("No access token");
    return principal;
  },
);
