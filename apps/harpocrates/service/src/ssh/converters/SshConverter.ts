import moment from "moment";
import type {
  SshCa as SshCaRow,
  SshPrincipalMapping as SshPrincipalMappingRow,
} from "../../store/prisma";
import type { SshCa, SshPrincipalMapping } from "../../model/ssh";

/** The line that trusts a CA (ADR 0035): what a host or client installs. */
export const trustLine = (row: SshCaRow, hostPattern: string): string =>
  row.type === "user"
    ? `${row.publicKey} ${row.name}`
    : `@cert-authority ${hostPattern} ${row.publicKey} ${row.name}`;

export const toSshCa = (row: SshCaRow, hostPattern: string): SshCa => ({
  id: row.id,
  name: row.name,
  type: row.type,
  number: row.number,
  generation: row.generation,
  status: row.status,
  publicKey: row.publicKey,
  trustLine: trustLine(row, hostPattern),
  maxValidityHours: row.maxValidityHours,
  krlUrl: row.krlUrl,
  // Beside the CA's own: krl/ssh-<type>.krl.
  typeKrlUrl: row.krlUrl.replace(/[^/]+\.krl$/, `ssh-${row.type}.krl`),
  retiredAt: row.retiredAt ? moment(row.retiredAt) : undefined,
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});

/** An identity's rows as one mapping, its principals in the order made. */
export const toMapping = (
  rows: SshPrincipalMappingRow[],
): SshPrincipalMapping => {
  const sorted = [...rows].sort((a, b) => a.id - b.id);
  return {
    identity: sorted[0].identity,
    principals: sorted.map((r) => r.principal),
    createdAt: moment(Math.min(...sorted.map((r) => r.createdAt.getTime()))),
    updatedAt: moment(Math.max(...sorted.map((r) => r.updatedAt.getTime()))),
  };
};
