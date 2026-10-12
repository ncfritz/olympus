import moment from "moment";
import type { CertificateLineage } from "../../model/lineages";
import type { LineageRow } from "../services/LineageService";

export const toLineage = (row: LineageRow): CertificateLineage => ({
  lineageId: row.lineageId,
  name: row.name,
  names: row.names,
  issuerId: row.issuerId,
  profileId: row.profileId,
  state: row.state,
  health: row.health,
  renewalDueAt: moment(row.renewalDueAt),
  renewal: row.renewal,
  renewer: row.renewer,
  deployTargets: row.deployTargets,
  versions: row.versions.map((v) => ({
    certificateId: v.certificateId,
    issuerId: v.issuerId,
    serial: v.serial,
    notBefore: moment(v.notBefore),
    notAfter: moment(v.notAfter),
    issuedAt: moment(v.issuedAt),
    state: v.state,
    revokedAt: v.revokedAt ? moment(v.revokedAt) : undefined,
    revocationReason: v.revocationReason,
    renews: v.renews,
  })),
});
