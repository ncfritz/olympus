import moment from "moment";
import type { AcmeCredential } from "../../model/acme";
import type {
  AcmeAccount,
  AcmeAccountContact,
  AcmeEabCredential,
  AcmeNamePolicy,
} from "../../store/prisma";

export type CredentialWithAccount = AcmeEabCredential & {
  names: AcmeNamePolicy[];
  account: (AcmeAccount & { contacts: AcmeAccountContact[] }) | null;
};

export const CREDENTIAL_INCLUDE = {
  names: { orderBy: { value: "asc" } },
  account: { include: { contacts: { orderBy: { uri: "asc" } } } },
} as const;

export const toAcmeCredential = (
  row: CredentialWithAccount,
): AcmeCredential => ({
  id: row.id,
  label: row.label,
  names: {
    exact: row.names.filter((n) => n.kind === "exact").map((n) => n.value),
    subtrees: row.names.filter((n) => n.kind === "subtree").map((n) => n.value),
  },
  principal: row.principal,
  boundAt: row.boundAt ? moment(row.boundAt) : undefined,
  revokedAt: row.revokedAt ? moment(row.revokedAt) : undefined,
  account: row.account
    ? {
        id: row.account.id,
        status: row.account.status,
        contacts: row.account.contacts.map((c) => c.uri),
        keyThumbprint: row.account.keyThumbprint,
        createdAt: moment(row.account.createdAt),
        updatedAt: moment(row.account.updatedAt),
      }
    : undefined,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});
