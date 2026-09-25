export const BASE_USER = `id
  displayName
  email
  disabled`;

export const USER_WITH_ROLES = `${BASE_USER}
  roles {
    role
  }`;

/** A user as the `auth:user` CLI shows them: roles and linked identities. */
export const ADMIN_USER = `${USER_WITH_ROLES}
  identities {
    provider
    subject
    email
  }`;

export const BASE_SESSION = `id
  userId
  clientId
  deviceName
  createdTime
  lastUsedTime
  expiresTime
  revokedTime`;

/** Just enough of a session to decide whether a refresh may proceed. */
export const SESSION_FOR_REFRESH = `id
  userId
  clientId
  createdTime
  expiresTime
  revokedTime`;
