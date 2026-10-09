import { X509Certificate } from "crypto";
import * as fs from "fs";
import { TesterError } from "./errors";

export type ServiceIdentity = {
  /** The common name, which is the principal the API resolves (ADR 0018). */
  commonName: string;
  /** The organizational unit: the deployment. */
  deployment?: string;
  subject: string;
  issuer: string;
  validTo: string;
};

/**
 * Who a certificate says the caller is.
 *
 * Read here rather than taken as a flag because the API rejects a request
 * whose `X-Olympus-Client` disagrees with the certificate's common name, and
 * a tester that made you type both would spend its time proving that you can
 * type.
 */
export const readServiceIdentity = (
  certificatePath: string,
): ServiceIdentity => {
  let certificate: X509Certificate;
  try {
    certificate = new X509Certificate(fs.readFileSync(certificatePath));
  } catch (error: unknown) {
    throw new TesterError(
      `${certificatePath} is not a readable PEM certificate: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const field = (name: string): string | undefined =>
    certificate.subject
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith(`${name}=`))
      ?.slice(name.length + 1);

  const commonName = field("CN");
  if (commonName === undefined || commonName === "") {
    throw new TesterError(
      `${certificatePath} has no common name, so there is no identity to present`,
    );
  }
  return {
    commonName,
    ...(field("OU") === undefined ? {} : { deployment: field("OU")! }),
    subject: certificate.subject.split("\n").join(", "),
    issuer: certificate.issuer.split("\n").join(", "),
    validTo: certificate.validTo,
  };
};
