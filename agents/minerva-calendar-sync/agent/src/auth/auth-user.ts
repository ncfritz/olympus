import type { Request } from "express";

export interface AuthUser {
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}
