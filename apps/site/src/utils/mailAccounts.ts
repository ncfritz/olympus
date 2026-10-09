/**
 * What a Gmail sign-in came back with (CompleteMailAccountConnect's
 * outcome in the query), said once on the Inbox page.
 */
export type MailLinkOutcome = {
  type: "success" | "info" | "warning" | "error";
  title: string;
  description: string;
};

/** The query keys mailLinkOutcome reads, to clear once shown. */
export const MAIL_LINK_OUTCOME_KEYS = ["mailAccount", "reason", "accountId"];

export const mailLinkOutcome = (
  query: Record<string, string | string[] | undefined>,
): MailLinkOutcome | undefined => {
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };
  switch (one("mailAccount")) {
    case "connected":
      return {
        type: "success",
        title: "Linked to Gmail.",
        description: "Minerva can read this mailbox from Gmail now.",
      };
    case "cancelled":
      return {
        type: "info",
        title: "Sign-in cancelled.",
        description: "Nothing changed.",
      };
    case "expired":
      return {
        type: "warning",
        title: "That sign-in took too long.",
        description: "Sign-ins have ten minutes; start again.",
      };
    case "refused":
      return one("reason") === "owned"
        ? {
            type: "error",
            title: "That Google account is linked to another mailbox.",
            description: "Each Google account links one mailbox.",
          }
        : {
            type: "error",
            title: "You signed in as another account.",
            description:
              "Sign in at Google as the mailbox itself: the same address, and the same account it was linked with before.",
          };
    case "failed":
      return {
        type: "error",
        title: "Linking didn't work.",
        description:
          "Try again in a minute; if it keeps failing, the mail agent's log says why.",
      };
    default:
      return undefined;
  }
};

/** The page Google's sign-in comes back to: the Inbox. */
export const mailReturnTo = (origin: string): string =>
  `${origin}/minerva/mail`;
