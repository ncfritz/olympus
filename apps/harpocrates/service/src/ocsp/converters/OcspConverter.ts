import moment from "moment";
import type { OcspResponder } from "../../model/ocsp";
import { certificatePem } from "../../pki/x509";
import type { OcspResponder as OcspResponderRow } from "../../store/prisma";

export const toOcspResponder = (row: OcspResponderRow): OcspResponder => ({
  id: row.id,
  issuerId: row.issuerId,
  serial: row.serial,
  subject: row.subject,
  notBefore: moment(row.notBefore),
  notAfter: moment(row.notAfter),
  status: row.status,
  ceremonyId: row.ceremonyId ?? undefined,
  certificate: certificatePem(row.certificate),
  createdAt: moment(row.createdAt),
  updatedAt: moment(row.updatedAt),
});
