import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { Principal, RequestWithPrincipal } from "./principal";

export const IS_PUBLIC = "olympus:public";
export const REQUIRED_ROLES = "olympus:roles";

/** No credentials needed: sign-in, the OpenAPI document, /metrics. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The request's principal needs one of these roles. */
export const Roles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES, roles);

/** The verified principal, or undefined on a public route. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal | undefined =>
    context.switchToHttp().getRequest<RequestWithPrincipal>().principal,
);
