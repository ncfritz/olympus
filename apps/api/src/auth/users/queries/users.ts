export const BASE_USER = `id
  displayName
  email
  disabled`;

export const USER_WITH_ROLES = `${BASE_USER}
  roles {
    role
  }`;

export const BASE_SESSION = `id
  userId
  clientId
  deviceName
  createdTime
  lastUsedTime
  expiresTime
  revokedTime`;
