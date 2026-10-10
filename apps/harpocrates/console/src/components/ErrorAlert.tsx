"use client";

import { Alert, Button } from "antd";
import { signInAgainHref } from "@/lib/api/client";
import { ApiError, messageOf } from "@/lib/api/errors";

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
          ? "This needs a sign-in from the last few minutes. Signing in again brings you back here; what you entered on this page is not kept."
          : messageOf(error)
      }
      action={
        recent ? (
          <Button size="small" href={signInAgainHref()}>
            Sign in again
          </Button>
        ) : undefined
      }
    />
  );
}
