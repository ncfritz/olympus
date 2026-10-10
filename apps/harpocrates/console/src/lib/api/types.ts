import type { components } from "../../generated/api";

type Schemas = components["schemas"];

export type Issuer = Schemas["Issuer"];
export type FullIssuer = Schemas["FullIssuer"];
export type IssuerShape = Schemas["IssuerShape"];
export type IssuerTier = Schemas["IssuerTier"];
export type IssuerStatus = Schemas["IssuerStatus"];
export type IssuerPreview = Schemas["IssuerPreview"];
export type PreviewIssuerRequest = Schemas["PreviewIssuerRequest"];
export type PreviewIssuerResponse = Schemas["PreviewIssuerResponse"];
export type KeyAlgorithm = Schemas["KeyAlgorithm"];
export type NameConstraints = Schemas["NameConstraints"];
export type Names = Schemas["Names"];
export type SignerStatus = Schemas["SignerStatus"];
export type Ceremony = Schemas["Ceremony"];
export type Certificate = Schemas["Certificate"];
export type FullCertificate = Schemas["FullCertificate"];
export type CertificateState = Schemas["CertificateState"];
export type KeyExportFormat = Schemas["KeyExportFormat"];
export type Profile = Schemas["Profile"];
export type AuditEvent = Schemas["AuditEvent"];
export type RevocationList = Schemas["RevocationList"];
export type CurrentUser = Schemas["CurrentUser"];
export type PkiRole = CurrentUser["roles"][number];
