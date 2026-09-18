import { CertificationType } from "@ncfritz/olympus-model";
import { Timestamped, Wrapped } from "../metadata";

export type GraphQlCertification = {
  certification: string;
  country: string;
  createdTime: string;
  lastUpdatedTime: string;
  meaning: string;
  order: number;
  type: CertificationType;
};

export type GraphQlCertificationWrapper = Timestamped &
  Wrapped<GraphQlCertification, "certification">;
