import type { PrismaService } from "../store/PrismaService";

/** The common name of an RFC 4514 subject, or the subject. */
const nameOf = (subject: string): string =>
  /(?:^|,)CN=((?:\\.|[^,])*)/.exec(subject)?.[1]?.replace(/\\(.)/g, "$1") ??
  subject;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * What audit events concern, by name: a certificate's or a CA's common
 * name, a deploy target's name; keyed `<subjectType>:<subjectId>`. Other
 * subjects are named by their ID, which is their name already.
 */
export const subjectNamesOf = async (
  prisma: PrismaService,
  events: { subjectType: string | null; subjectId: string | null }[],
): Promise<Map<string, string>> => {
  const ids = (type: string) => [
    ...new Set(
      events
        .filter((e) => e.subjectType === type && e.subjectId)
        .map((e) => e.subjectId!),
    ),
  ];
  const [certificates, issuers, targets] = await Promise.all([
    prisma.certificate.findMany({
      where: { id: { in: ids("certificate").filter((id) => UUID.test(id)) } },
      select: { id: true, subject: true },
    }),
    prisma.issuer.findMany({
      where: { id: { in: ids("issuer") } },
      select: { id: true, subject: true },
    }),
    prisma.deployTarget.findMany({
      where: {
        id: { in: ids("deploy-target").filter((id) => UUID.test(id)) },
      },
      select: { id: true, name: true },
    }),
  ]);
  return new Map<string, string>([
    ...certificates.map((c): [string, string] => [
      `certificate:${c.id}`,
      nameOf(c.subject),
    ]),
    ...issuers.map((i): [string, string] => [
      `issuer:${i.id}`,
      nameOf(i.subject),
    ]),
    ...targets.map((t): [string, string] => [`deploy-target:${t.id}`, t.name]),
  ]);
};
