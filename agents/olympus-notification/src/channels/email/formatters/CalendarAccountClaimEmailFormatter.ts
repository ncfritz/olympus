import { CALENDAR_ACCOUNT_CLAIM_NOTIFICATION } from "@ncfritz/olympus-messages";
import moment from "moment";
import type {
  MinervaCalendarAccountClaimContext,
  MinervaCalendarAccountClaimMessageContext,
} from "../../../delivery/contexts/minerva";
import type { EmailTemplates } from "../services/EmailTemplates";
import { HandlebarsEmailFormatter } from "./HandlebarsEmailFormatter";

const PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
};

/**
 * minerva_calendar_account_claim: the link that confirms a claim on a
 * calendar account, mailed to the account's address (ADR 0028). Everything
 * it shows comes in the message; nothing is fetched.
 */
export class CalendarAccountClaimEmailFormatter extends HandlebarsEmailFormatter<
  MinervaCalendarAccountClaimContext,
  MinervaCalendarAccountClaimMessageContext
> {
  constructor(templates: EmailTemplates) {
    super(CALENDAR_ACCOUNT_CLAIM_NOTIFICATION, templates);
  }

  async buildContext(
    context: MinervaCalendarAccountClaimContext,
  ): Promise<MinervaCalendarAccountClaimMessageContext> {
    return {
      claimantName: context.claimantName,
      claimantEmail: context.claimantEmail,
      provider: context.provider,
      accountEmail: context.accountEmail,
      link: context.link,
      expiresTime: context.expiresTime,
      providerName: PROVIDER_NAMES[context.provider] ?? context.provider,
      // UTC, said so: the reader's time zone is not known here.
      expiresText: moment
        .utc(context.expiresTime)
        .format("dddd, MMMM D, YYYY [at] HH:mm [UTC]"),
    };
  }
}
