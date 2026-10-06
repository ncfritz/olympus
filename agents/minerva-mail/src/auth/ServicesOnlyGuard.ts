import { identifyPeerCertificate } from "@ncfritz/olympus-nest";
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import {
  servicesConfig,
  type ServicesConfigType,
} from "../config/configuration";

/** Set on a request by the services listener (main.ts). */
export type ServicesRequest = {
  listener?: "services";
  socket?: unknown;
};

/**
 * The management API is for the Olympus API alone (ADR 0028's rule for
 * agents with a services listener): a request must have come through the
 * services listener, whose handshake verified the certificate, from an
 * issuer and a common name allowed (AUTH_SERVICES_ISSUER,
 * AUTH_SERVICE_CLIENTS). The plain listener serves /metrics only.
 */
@Injectable()
export class ServicesOnlyGuard implements CanActivate {
  private readonly logger = new Logger(ServicesOnlyGuard.name);

  constructor(
    @Inject(servicesConfig.KEY) private readonly config: ServicesConfigType,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ServicesRequest>();
    if (request.listener !== "services") {
      throw new UnauthorizedException(
        "Only on the services listener, with a client certificate",
      );
    }
    const identity = identifyPeerCertificate(
      request.socket,
      this.config.issuer,
    );
    if ("reason" in identity) {
      this.logger.warn(`Refused a request: ${identity.reason}`);
      throw new UnauthorizedException(identity.reason);
    }
    if (!(this.config.clients ?? []).includes(identity.name)) {
      this.logger.warn(`Refused a request from ${identity.name}`);
      throw new ForbiddenException(`${identity.name} may not call this agent`);
    }
    return true;
  }
}
