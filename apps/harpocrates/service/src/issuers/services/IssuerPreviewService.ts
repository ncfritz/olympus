import { Injectable, NotFoundException } from "@nestjs/common";
import moment from "moment";
import type { NameConstraints } from "../../model/common";
import type {
  IssuerPreview,
  PreviewIssuerRequest,
  PreviewIssuerResponse,
} from "../../model/issuers";
import { PrismaService } from "../../store/PrismaService";
import type { IssuerWithRules } from "../converters/IssuerConverter";
import { type IssuerNameParts, issuerSlug } from "../issuerNames";
import {
  addDays,
  childNotAfter,
  describeSigned,
  isIssuingWindowOpen,
  noTimeToSign,
  offlineMaxValidityDays,
  SHAPE_PATH_LENGTH,
  signedInCeremony,
  TIER_PATH_LENGTH,
  TIER_VALIDITY_DAYS,
} from "../issuingWindow";
import { IssuerService, startNow } from "./IssuerService";

const DAY = 24 * 60 * 60 * 1000;

/** The settings the operator may change from their defaults (ADR 0032). */
type Overridable = Pick<
  PreviewIssuerRequest,
  | "organization"
  | "subject"
  | "validityDays"
  | "algorithm"
  | "nameConstraints"
  | "maxValidityDays"
  | "extendedKeyUsages"
>;

/** What the profiles of an issuing CA's purpose need it to sign. */
type PurposeNeeds = { maxValidityDays: number; extendedKeyUsages: string[] };

/**
 * A new CA before anything is signed (ADR 0032, Names and settings):
 * every setting as the create operation would use it, beside its default,
 * and why that operation would refuse it. Nothing is written and nothing
 * is signed, so the console can show the operator the whole of a CA to
 * review before its ceremony.
 */
@Injectable()
export class IssuerPreviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issuers: IssuerService,
  ) {}

  async preview(request: PreviewIssuerRequest): Promise<PreviewIssuerResponse> {
    const problems: string[] = [];
    const parent = await this.parentOf(request, problems);
    const parts: IssuerNameParts = {
      tier: request.tier,
      purpose: request.purpose,
      number: request.number,
      generation: request.generation,
    };
    if (request.tier === "issuing" && !request.purpose) {
      problems.push("An issuing CA needs a purpose: TLS, Service, ...");
    }
    const id = issuerSlug(parts);
    if (await this.prisma.issuer.findUnique({ where: { id } })) {
      problems.push(`Issuer ${id} already exists`);
    }
    const needs =
      request.tier === "issuing" && request.purpose
        ? await this.needsOf(request.purpose)
        : undefined;
    if (
      request.tier === "issuing" &&
      !needs &&
      (request.maxValidityDays === undefined ||
        request.extendedKeyUsages === undefined)
    ) {
      problems.push(
        `No profile issues from a ${request.purpose ?? "purposeless"} CA: give its maximum validity and extended key usages`,
      );
    }

    const now = startNow();
    const build = (overrides: Overridable): IssuerPreview => {
      const organization =
        overrides.organization ?? parent?.organization ?? undefined;
      const notAfter = this.notAfter(
        request,
        parent,
        now,
        overrides.validityDays,
      );
      return {
        id,
        subject:
          overrides.subject ?? this.issuers.subjectFor(parts, organization),
        organization: this.issuers.organizationFor(organization),
        validityDays: Math.round((notAfter.getTime() - now.getTime()) / DAY),
        notAfter: moment(notAfter),
        algorithm: overrides.algorithm ?? "P-256",
        pathLength:
          request.tier === "root"
            ? SHAPE_PATH_LENGTH[request.shape ?? "three_tier"]
            : TIER_PATH_LENGTH[request.tier],
        keyUsages:
          request.tier === "issuing"
            ? ["digital_signature", "key_cert_sign", "crl_sign"]
            : ["key_cert_sign", "crl_sign"],
        extendedKeyUsages:
          request.tier === "issuing"
            ? (overrides.extendedKeyUsages ?? needs?.extendedKeyUsages ?? [])
            : [],
        maxValidityDays:
          request.tier === "issuing"
            ? (overrides.maxValidityDays ?? needs?.maxValidityDays ?? 0)
            : offlineMaxValidityDays(
                request.tier,
                request.tier === "root"
                  ? (request.shape ?? "three_tier")
                  : undefined,
              ),
        nameConstraints: nonEmpty(overrides.nameConstraints),
        ...this.issuers.urlsFor(id),
        crlDistributionPoint: parent?.crlUrl,
        issuerUrl: parent?.caIssuersUrl,
      };
    };

    const preview = build(request);
    const defaults = build({});

    if (
      parent?.notAfter &&
      request.validityDays !== undefined &&
      addDays(now, request.validityDays) > parent.notAfter
    ) {
      problems.push(
        `${request.validityDays} days would outlive its parent, which expires ${parent.notAfter.toISOString()}`,
      );
    }
    const idle =
      preview.maxValidityDays > 0 &&
      noTimeToSign(now, preview.notAfter.toDate(), preview.maxValidityDays);
    if (idle) problems.push(idle);
    if (
      await this.prisma.issuer.findUnique({
        where: { subject: preview.subject },
      })
    ) {
      problems.push(
        `A CA with the subject ${preview.subject} exists: a subject is never reused`,
      );
    }
    const allowed = parent?.extendedKeyUsages.map((eku) => eku.oid) ?? [];
    const outside = preview.extendedKeyUsages.filter(
      (oid) => allowed.length > 0 && !allowed.includes(oid),
    );
    if (outside.length > 0) {
      problems.push(
        `${parent?.id} may not sign the extended key usages ${outside.join(", ")}`,
      );
    }
    return { preview, defaults, problems };
  }

  /** The CA that would sign it, checked as its ceremony would check it. */
  private async parentOf(
    request: PreviewIssuerRequest,
    problems: string[],
  ): Promise<IssuerWithRules | undefined> {
    if (request.tier === "root") {
      if (request.parentId) problems.push("A root has no parent");
      return undefined;
    }
    if (!request.parentId) {
      problems.push(`An ${request.tier} CA needs the CA that signs it`);
      return undefined;
    }
    let parent: IssuerWithRules;
    try {
      parent = await this.issuers.row(request.parentId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        problems.push(`There is no CA ${request.parentId}`);
        return undefined;
      }
      throw error;
    }
    if (parent.tier === "issuing") {
      problems.push(`${parent.id} is online: an online key never signs a CA`);
      return parent;
    }
    const signs = signedInCeremony(parent);
    if (signs !== request.tier) {
      problems.push(
        `${parent.id} signs ${describeSigned(signs)}, not ${request.tier} CAs`,
      );
    }
    if (
      parent.status !== "active" ||
      !isIssuingWindowOpen(parent.notAfter, parent.maxValidityDays)
    ) {
      problems.push(
        `Issuer ${parent.id} no longer signs: create its successor`,
      );
    }
    return parent;
  }

  /** Its expiry: as asked, or its tier's lifetime within its parent's. */
  private notAfter(
    request: PreviewIssuerRequest,
    parent: IssuerWithRules | undefined,
    now: Date,
    validityDays: number | undefined,
  ): Date {
    if (validityDays !== undefined) return addDays(now, validityDays);
    if (request.tier === "root" || !parent?.notAfter) {
      return addDays(now, TIER_VALIDITY_DAYS[request.tier]);
    }
    return childNotAfter(now, request.tier, parent.notAfter);
  }

  /**
   * What the profiles of a purpose need of its issuing CA: their longest
   * validity, and every extended key usage among them.
   */
  private async needsOf(purpose: string): Promise<PurposeNeeds | undefined> {
    const profiles = await this.prisma.profile.findMany({
      where: { issuerPurpose: purpose, directOnly: false },
      include: { extendedKeyUsages: true },
    });
    if (profiles.length === 0) return undefined;
    return {
      maxValidityDays: Math.max(
        ...profiles.map((profile) => profile.validityDays),
      ),
      extendedKeyUsages: [
        ...new Set(
          profiles.flatMap((profile) =>
            profile.extendedKeyUsages.map((eku) => eku.oid),
          ),
        ),
      ].sort(),
    };
  }
}

/** Name constraints, or none when they constrain nothing. */
const nonEmpty = (
  constraints: NameConstraints | undefined,
): NameConstraints | undefined =>
  constraints &&
  (Object.values(constraints.permitted ?? {}).some((v) => v?.length) ||
    Object.values(constraints.excluded ?? {}).some((v) => v?.length))
    ? constraints
    : undefined;
