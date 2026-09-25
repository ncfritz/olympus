import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { Principal, RequestWithPrincipal } from "./principal";

export const IS_PUBLIC = "olympus:public";
export const REQUIRED_ROLES = "olympus:roles";
export const REQUIRES_IDENTITY = "olympus:requiresIdentity";

/** No credentials needed: sign-in, the OpenAPI document, /metrics. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The request's principal needs one of these roles. */
export const Roles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES, roles);

/**
 * This route is refused without a principal even where its listener is in
 * `report` mode.
 *
 * Report mode exists so that callers can be moved onto credentials one at a
 * time: an unauthenticated request is served, and what would have been
 * refused is counted. That is the right trade for an endpoint that has a
 * job to do either way. It is incoherent for one whose subject *is* the
 * caller — "describe the current user" with no current user has no answer,
 * and inventing a default is how an endpoint ends up serving somebody
 * else's data. Those routes say so here, so the refusal still comes from
 * the guard and still lands in auth_decisions_total.
 */
export const RequiresIdentity = () => SetMetadata(REQUIRES_IDENTITY, true);

/** The verified principal, or undefined on a public route. */
export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal | undefined =>
    context.switchToHttp().getRequest<RequestWithPrincipal>().principal,
);
