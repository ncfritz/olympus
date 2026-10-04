import { Inject, Injectable } from "@nestjs/common";
import {
  microsoftConfig,
  type MicrosoftConfigType,
} from "../../config/configuration";
import { MicrosoftCredentialStore } from "../../providers/microsoft/MicrosoftCredentialStore";
import {
  buildMicrosoftWebAuthUrl,
  completeMicrosoftWebSignIn,
  MICROSOFT_NEW_ACCOUNT_SCOPES,
  refreshMicrosoftAccessToken,
  startMicrosoftLoopbackFlow,
} from "../../providers/microsoft/microsoftOauth";
import { confirmSameAccount } from "../accountIdentity";
import {
  CalendarAuthStrategy,
  LoopbackFlow,
  LoopbackFlowRequest,
  type WebSignInCallback,
  type WebSignInResult,
  type WebSignInStart,
} from "./calendarAuthStrategy";

@Injectable()
export class MicrosoftAuthStrategy implements CalendarAuthStrategy {
  readonly provider = "microsoft" as const;

  constructor(
    private readonly credentials: MicrosoftCredentialStore,
    @Inject(microsoftConfig.KEY)
    private readonly microsoft: MicrosoftConfigType,
  ) {}

  listStoredAccountLabels(): string[] {
    return this.credentials.listAccountLabels();
  }

  tryLoadCredential(accountLabel: string) {
    return this.credentials.tryLoad(accountLabel);
  }

  async checkAccessToken(
    accountLabel: string,
  ): Promise<{ expiresAt?: string }> {
    const credential = this.credentials.tryLoad(accountLabel);
    if (!credential) {
      throw new Error(`No stored Microsoft credential for "${accountLabel}"`);
    }
    const { expiresAt } = await refreshMicrosoftAccessToken(
      this.microsoft,
      credential.refreshToken,
      credential.client ?? "public",
    );
    return { expiresAt };
  }

  async recordSubject(accountLabel: string): Promise<string | undefined> {
    const credential = this.credentials.tryLoad(accountLabel);
    if (!credential) return undefined;
    if (credential.subject) return credential.subject;
    const { subject } = await refreshMicrosoftAccessToken(
      this.microsoft,
      credential.refreshToken,
      credential.client ?? "public",
    );
    if (subject) this.credentials.save({ ...credential, subject });
    return subject;
  }

  async startLoopbackFlow(request: LoopbackFlowRequest): Promise<LoopbackFlow> {
    const scopes = MICROSOFT_NEW_ACCOUNT_SCOPES;
    const flow = await startMicrosoftLoopbackFlow(this.microsoft, scopes);

    return {
      authUrl: flow.authUrl,
      complete: async (timeoutMs) => {
        const result = await flow.complete(timeoutMs);
        if (request.mode === "reauth") {
          confirmSameAccount(
            request.accountLabel,
            this.credentials.tryLoad(request.accountLabel)?.subject,
            { subject: result.subject, email: result.email },
          );
        }
        const accountLabel =
          request.mode === "new"
            ? requireEmail(result.email)
            : request.accountLabel;
        this.credentials.save({
          accountLabel,
          refreshToken: result.refreshToken,
          scope: result.scope,
          obtainedAt: new Date().toISOString(),
          subject: result.subject,
        });
        return { accountLabel, scope: result.scope };
      },
    };
  }

  startWebSignIn(start: WebSignInStart): Promise<string> {
    return buildMicrosoftWebAuthUrl(
      this.microsoft,
      MICROSOFT_NEW_ACCOUNT_SCOPES,
      start,
    );
  }

  async completeWebSignIn(
    callback: WebSignInCallback,
  ): Promise<WebSignInResult> {
    const result = await completeMicrosoftWebSignIn(
      this.microsoft,
      MICROSOFT_NEW_ACCOUNT_SCOPES,
      callback,
    );
    let accountLabel: string;
    if (callback.accountLabel === undefined) {
      accountLabel = requireEmail(result.email);
    } else {
      confirmSameAccount(
        callback.accountLabel,
        this.credentials.tryLoad(callback.accountLabel)?.subject,
        { subject: result.subject, email: result.email },
      );
      accountLabel = callback.accountLabel;
    }
    const created = this.credentials.tryLoad(accountLabel) === undefined;
    this.credentials.save({
      accountLabel,
      refreshToken: result.refreshToken,
      scope: result.scope,
      obtainedAt: new Date().toISOString(),
      subject: result.subject,
      client: "web",
    });
    return { accountLabel, subject: result.subject, created };
  }

  removeCredential(accountLabel: string): void {
    this.credentials.remove(accountLabel);
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
