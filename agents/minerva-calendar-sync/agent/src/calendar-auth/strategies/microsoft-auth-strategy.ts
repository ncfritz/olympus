import {
  listStoredAccountLabels,
  saveMicrosoftCredential,
  tryLoadMicrosoftCredential,
} from "../../providers/microsoft/microsoft-credential-store";
import {
  MICROSOFT_CALENDAR_SCOPES,
  MICROSOFT_NEW_ACCOUNT_SCOPES,
  refreshMicrosoftAccessToken,
  startMicrosoftLoopbackFlow,
} from "../../providers/microsoft/microsoft-oauth";
import {
  CalendarAuthStrategy,
  LoopbackFlow,
  LoopbackFlowRequest,
} from "./calendar-auth-strategy";

export class MicrosoftAuthStrategy implements CalendarAuthStrategy {
  readonly provider = "microsoft" as const;

  listStoredAccountLabels(): string[] {
    return listStoredAccountLabels();
  }

  tryLoadCredential(accountLabel: string) {
    return tryLoadMicrosoftCredential(accountLabel);
  }

  async checkAccessToken(
    accountLabel: string,
  ): Promise<{ expiresAt?: string }> {
    const credential = tryLoadMicrosoftCredential(accountLabel);
    if (!credential) {
      throw new Error(`No stored Microsoft credential for "${accountLabel}"`);
    }
    const { expiresAt } = await refreshMicrosoftAccessToken(
      credential.refreshToken,
    );
    return { expiresAt };
  }

  async startLoopbackFlow(request: LoopbackFlowRequest): Promise<LoopbackFlow> {
    const scopes =
      request.mode === "new"
        ? MICROSOFT_NEW_ACCOUNT_SCOPES
        : MICROSOFT_CALENDAR_SCOPES;
    const flow = await startMicrosoftLoopbackFlow(scopes);

    return {
      authUrl: flow.authUrl,
      complete: async (timeoutMs) => {
        const result = await flow.complete(timeoutMs);
        const accountLabel =
          request.mode === "new"
            ? requireEmail(result.email)
            : request.accountLabel;
        saveMicrosoftCredential({
          accountLabel,
          refreshToken: result.refreshToken,
          scope: result.scope,
          obtainedAt: new Date().toISOString(),
        });
        return { accountLabel, scope: result.scope };
      },
    };
  }

  isInvalidGrantError(error: unknown): boolean {
    return (error as { error?: string })?.error === "invalid_grant";
  }

  errorMessage(error: unknown): string {
    const err = error as { error?: string; error_description?: string };
    if (err?.error) {
      return err.error_description
        ? `${err.error}: ${err.error_description}`
        : err.error;
    }
    return error instanceof Error ? error.message : String(error);
  }
}

function requireEmail(email: string | undefined): string {
  if (!email) {
    throw new Error(
      "Microsoft did not return a verified email address for this account",
    );
  }
  return email;
}
