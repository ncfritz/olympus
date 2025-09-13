export const IS_PROD = process.env.NODE_ENV === "production";

export const NOTIFICATIONS_PREFIX = "notifications";
export const TRIGGER_SUFFIX = "trigger";
export const DESTINATION_APP_SUFFIX = "app";
export const DESTINATION_SYNOCHAT_SUFFIX = "synochat";
export const DESTINATION_SYNOMAIL_SUFFIX = "synomail";
export const DESTINATION_GMAIL_SUFFIX = "email";
export const DESTINATION_WEBSOCKET_SUFFIX = "ws";

export const NOTIFICATIONS_EXCHANGE = `${NOTIFICATIONS_PREFIX}.${TRIGGER_SUFFIX}`;
