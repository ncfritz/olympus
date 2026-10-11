import { ApiTimestamp } from "@ncfritz/olympus-model";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, Matches } from "class-validator";
import type { Moment } from "moment";

export const DEPLOY_KIND_VALUES = ["host_path"] as const;
export type DeployKindName = (typeof DEPLOY_KIND_VALUES)[number];

export const DEPLOY_KIND_ENUM = {
  enum: [...DEPLOY_KIND_VALUES],
  enumName: "DeployKind",
  enumSchema: {
    description:
      "How a target installs a certificate: host_path writes files a web server reads and reloads",
  },
};

export const DEPLOYMENT_STATUS_VALUES = [
  "pending",
  "deployed",
  "superseded",
] as const;
export type DeploymentStatusName = (typeof DEPLOYMENT_STATUS_VALUES)[number];

export const DEPLOYMENT_STATUS_ENUM = {
  enum: [...DEPLOYMENT_STATUS_VALUES],
  enumName: "DeploymentStatus",
  enumSchema: {
    description:
      "pending: to do, or failing and retried; deployed; superseded: replaced by a newer deployment before it succeeded",
  },
};

export const ENDPOINT_RESULT_VALUES = [
  "current",
  "previous",
  "other",
  "unreachable",
] as const;
export type EndpointResultName = (typeof ENDPOINT_RESULT_VALUES)[number];

export const ENDPOINT_RESULT_ENUM = {
  enum: [...ENDPOINT_RESULT_VALUES],
  enumName: "EndpointResult",
  enumSchema: {
    description:
      "What an endpoint served: current, the target's certificate; previous, one it deployed before (not reloaded); other, one it never deployed; unreachable, no TLS handshake",
  },
};

/** host:port: a DNS name or IPv4 address, or an IPv6 address in brackets. */
export const DEPLOY_TARGET_ENDPOINT =
  /^(?:[A-Za-z0-9][A-Za-z0-9.-]*|\[[0-9A-Fa-f:.]+\]):\d{1,5}$/;

/** A target's name: also its directory, so a single safe path segment. */
export const DEPLOY_TARGET_NAME = /^[a-z0-9][a-z0-9.-]{0,62}$/;

/* ------------------------------------------------------------------------------------------------------------------ */
/* Domain Objects                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

/** One certificate, installed at one target. */
export class Deployment {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The certificate it installs",
  })
  certificateId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The certificate's serial, hex",
  })
  serial: string;

  @ApiProperty({
    ...DEPLOYMENT_STATUS_ENUM,
    required: true,
    description: "Whether it is done",
  })
  status: DeploymentStatusName;

  @ApiProperty({
    type: String,
    required: true,
    description: "Who asked for it: `system` when it followed a renewal",
  })
  principal: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many times it was tried",
  })
  attempts: number;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when it was last tried",
  })
  lastAttemptAt?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why the last attempt failed",
  })
  lastError?: string;

  @ApiTimestamp({
    required: false,
    description: "An ISO-8601 formatted string: when it succeeded",
  })
  deployedAt?: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was asked for",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/** What a target's endpoint served, from when first seen to when last seen. */
export class EndpointObservation {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "The host:port checked",
  })
  endpoint: string;

  @ApiProperty({
    ...ENDPOINT_RESULT_ENUM,
    required: true,
    description: "What it served",
  })
  result: EndpointResultName;

  @ApiProperty({
    type: String,
    required: true,
    description: "The target's certificate when it was checked",
  })
  expectedCertificateId: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The certificate served, when this target deployed it",
  })
  servedCertificateId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The served certificate's SHA-256 fingerprint, hex",
  })
  servedSha256?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The served certificate's serial, hex",
  })
  servedSerial?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The served certificate's subject, RFC 4514",
  })
  servedSubject?: string;

  @ApiTimestamp({
    required: false,
    description:
      "An ISO-8601 formatted string: when the served certificate expires",
  })
  servedNotAfter?: Moment;

  @ApiProperty({
    type: String,
    required: false,
    description: "Why there was no handshake",
  })
  error?: string;

  @ApiProperty({
    type: Number,
    required: true,
    description: "How many checks saw this",
  })
  checks: number;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was first seen",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was last seen",
  })
  updatedAt: Moment;
}

/**
 * Where a certificate is installed for something that can neither renew
 * over mutual TLS nor speak ACME (ADR 0020, Renewal and delivery).
 */
export class DeployTarget {
  @ApiProperty({ type: String, required: true, description: "Its ID" })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "Its name, which is also its directory under DEPLOY_DIR",
  })
  name: string;

  @ApiProperty({
    ...DEPLOY_KIND_ENUM,
    required: true,
    description: "How it installs a certificate",
  })
  kind: DeployKindName;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The certificate it deploys: the newest of its lineage, renewed by Harpocrates when due",
  })
  certificateId: string;

  @ApiProperty({
    type: String,
    required: true,
    description: "That certificate's subject, RFC 4514",
  })
  subject: string;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when that certificate expires",
  })
  notAfter: Moment;

  @ApiTimestamp({
    required: true,
    description:
      "An ISO-8601 formatted string: when Harpocrates renews that certificate",
  })
  renewsAt: Moment;

  @ApiProperty({
    type: String,
    required: true,
    description: "The host:port it is served at, and checked",
  })
  endpoint: string;

  @ApiProperty({
    type: () => Deployment,
    required: false,
    description: "Its newest deployment",
  })
  lastDeployment?: Deployment;

  @ApiProperty({
    type: () => EndpointObservation,
    required: false,
    description: "What its endpoint served when last checked",
  })
  lastObservation?: EndpointObservation;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it was created",
  })
  createdAt: Moment;

  @ApiTimestamp({
    required: true,
    description: "An ISO-8601 formatted string: when it last changed",
  })
  updatedAt: Moment;
}

/** A target with its deployments. */
export class FullDeployTarget extends DeployTarget {
  @ApiProperty({
    type: () => Deployment,
    isArray: true,
    required: true,
    description: "Its deployments, newest first",
  })
  deployments: Deployment[];

  @ApiProperty({
    type: () => EndpointObservation,
    isArray: true,
    required: true,
    description: "What its endpoint served, newest first",
  })
  observations: EndpointObservation[];
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Request Shapes                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

export class CreateDeployTargetRequest {
  @ApiProperty({
    type: String,
    required: true,
    description:
      "Its name, which is also its directory: lower-case letters, digits, dots and hyphens",
    example: "pki.internal.ncfritz.net",
  })
  @IsString()
  @Matches(DEPLOY_TARGET_NAME, {
    message:
      "name must be lower-case letters, digits, dots and hyphens, starting with a letter or digit, at most 63",
  })
  name: string;

  @ApiProperty({
    type: String,
    required: true,
    description:
      "The certificate to deploy: its key generated and escrowed, so Harpocrates can install it",
  })
  @IsUUID()
  certificateId: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      "The host:port it is served at, and checked: its name on 443 by default",
    example: "nas.internal.ncfritz.net:443",
  })
  @IsOptional()
  @IsString()
  @Matches(DEPLOY_TARGET_ENDPOINT, {
    message: "endpoint must be host:port",
  })
  endpoint?: string;
}

export class UpdateDeployTargetRequest {
  @ApiProperty({
    type: String,
    required: false,
    description:
      "The certificate to deploy from now on, deployed at once: a reissue, after a revocation",
  })
  @IsOptional()
  @IsUUID()
  certificateId?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: "The host:port it is served at, and checked, from now on",
    example: "nas.internal.ncfritz.net:443",
  })
  @IsOptional()
  @IsString()
  @Matches(DEPLOY_TARGET_ENDPOINT, {
    message: "endpoint must be host:port",
  })
  endpoint?: string;
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Response Shapes                                                                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

export class ListDeployTargetsResponse {
  @ApiProperty({
    type: () => DeployTarget,
    isArray: true,
    required: true,
    description: "Every deploy target, by name",
  })
  deployTargets: DeployTarget[];
}

export class DescribeDeployTargetResponse {
  @ApiProperty({
    type: () => FullDeployTarget,
    required: true,
    description: "The target",
  })
  deployTarget: FullDeployTarget;
}

export class CreateDeployTargetResponse {
  @ApiProperty({
    type: () => FullDeployTarget,
    required: true,
    description: "The target, and its first deployment as it went",
  })
  deployTarget: FullDeployTarget;
}

export class UpdateDeployTargetResponse {
  @ApiProperty({
    type: () => FullDeployTarget,
    required: true,
    description: "The target, and the deployment of its new certificate",
  })
  deployTarget: FullDeployTarget;
}

export class DeployDeployTargetResponse {
  @ApiProperty({
    type: () => FullDeployTarget,
    required: true,
    description: "The target, and the deployment as it went",
  })
  deployTarget: FullDeployTarget;
}

export class CheckDeployTargetResponse {
  @ApiProperty({
    type: () => FullDeployTarget,
    required: true,
    description: "The target, with what its endpoint served just now",
  })
  deployTarget: FullDeployTarget;
}
