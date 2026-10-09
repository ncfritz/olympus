import { SetMetadata } from "@nestjs/common";

export const SERVICES_ONLY_KEY = "servicesOnly";

/**
 * Marks a route only a service may call, on the services listener: the
 * Olympus API (ADR 0028). A signed-in console user is refused.
 */
export const ServicesOnly = () => SetMetadata(SERVICES_ONLY_KEY, true);
