/** httpOnly cookie the web app's browser session rides on; API/iOS clients use the Bearer header instead. */
export const ACCESS_TOKEN_COOKIE = "minerva_access_token";

/** Short-lived cookie holding the in-flight OIDC transaction (state/nonce/PKCE verifier) between login and callback. */
export const OIDC_TXN_COOKIE = "minerva_oidc_txn";
