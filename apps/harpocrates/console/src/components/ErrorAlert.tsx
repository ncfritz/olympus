"use client";

import { Alert } from "antd";
import { ApiError, messageOf } from "@/lib/api/errors";
import { SignInAgainButton } from "./RecentSignIn";

export interface ErrorAlertProps {
  error: unknown;
  title?: string;
}

/**
 * A refusal, with the service's reason. One that a newer sign-in would
 * lift offers it: ceremonies, creating a root and exporting a key want a
 * sign-in from the last few minutes (ADR 0020).
 */
export function ErrorAlert({ error, title = "Refused" }: ErrorAlertProps) {
  if (!error) return null;
  const recent = error instanceof ApiError && error.needsRecentSignIn;
  return (
    <Alert
      type="error"
      showIcon
      title={recent ? "Sign in again to do this" : title}
      description={
        recent
          ? "This needs a sign-in from the last few minutes. Signing in again opens in a small window; this page, and what you entered on it, stays as it is. Then try again."
          : messageOf(error)
      }
      action={recent ? <SignInAgainButton primary /> : undefined}
    />
  );
}
