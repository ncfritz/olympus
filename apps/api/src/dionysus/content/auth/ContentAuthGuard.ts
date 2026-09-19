import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { type Request } from "express";
import { ContentCurtain } from "./ContentCurtain";
import { contentAuthToken } from "./contentAuth";
import { ContentAuthService } from "./services/ContentAuthService";

const CONTENT_AUTH_REQUIRED = "dionysus:content-auth-required";

/** Marks a route whose requests must carry valid content auth (else 401). */
export const RequireContentAuth = () =>
  SetMetadata(CONTENT_AUTH_REQUIRED, true);

export type RequestWithCurtain = Request & { contentCurtain?: ContentCurtain };

/**
 * Authenticates the content auth cookie and attaches the request's
 * ContentCurtain. Requests without valid auth pass (and get the curtain)
 * unless the route is marked with RequireContentAuth, when they get 401.
 * Apply it with @ContentAuth().
 */
@Injectable()
export class ContentAuthGuard implements CanActivate {
  constructor(
    private readonly contentAuth: ContentAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCurtain>();
    const required =
      this.reflector.get<boolean>(
        CONTENT_AUTH_REQUIRED,
        context.getHandler(),
      ) ?? false;
    const authenticated = await this.contentAuth.authenticate(
      contentAuthToken(request),
      !required,
    );
    request.contentCurtain = new ContentCurtain(authenticated);
    return true;
  }
}
