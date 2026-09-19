import { Certification, PartialCertification } from "@ncfritz/olympus-model";
import { Injectable } from "@nestjs/common";
import { gql, GraphQLClient } from "graphql-request";
import { BASE_CERTIFICATION } from "../queries/certifications";
import {
  buildFilterExpression,
  buildPaginationExpression,
  PaginationParams,
} from "../../../../utils/filterUtil";
import { toDomainObject } from "../converters/CertificationConverter";
import { GraphQlCertification } from "../types/certification";

type GraphQlCreateCertificationResponse = {
  insert_dionysus_certifications_one: GraphQlCertification;
};

type GraphQlListCertificationsResponse = {
  dionysus_certifications: GraphQlCertification[];
  dionysus_certifications_aggregate: {
    aggregate: {
      count: number;
    };
  };
};

/** Movie and TV certifications in Hasura. */
@Injectable()
export class CertificationService {
  constructor(private readonly graphQLClient: GraphQLClient) {}

  /** Creates or updates a certification. */
  async create(certification: PartialCertification): Promise<Certification> {
    const insertRequest = gql`
      mutation CreateCertification(
        $country: String!
        $certification: String!
        $type: String!
        $meaning: String!
        $order: numeric
      ) {
        insert_dionysus_certifications_one(
          object: {
            certification: $certification
            country: $country
            meaning: $meaning
            order: $order
            type: $type
          }
          on_conflict: {
            constraint: certifications_pkey
            update_columns: [meaning, order]
          }
        ) {
          ${BASE_CERTIFICATION}
        }
      }
    `;

    const insertResponse =
      await this.graphQLClient.request<GraphQlCreateCertificationResponse>(
        insertRequest,
        {
          country: certification.country,
          certification: certification.certification,
          type: certification.type,
          order: certification.order,
          meaning: certification.meaning,
        },
      );

    return toDomainObject(insertResponse.insert_dionysus_certifications_one);
  }

  /** A page of certifications and the total count matching `filters`. */
  async list(
    pagination: PaginationParams,
    filters?: string,
  ): Promise<{ certifications: Certification[]; count: number }> {
    const whereExpression = buildFilterExpression(filters);
    const paginationExpression = buildPaginationExpression(pagination);

    const fetchRequest = gql`
      query ListCertifications {
        dionysus_certifications(${[paginationExpression, whereExpression].join(", ")}) {
          ${BASE_CERTIFICATION}
        }
        dionysus_certifications_aggregate${whereExpression ? `(${whereExpression})` : ""} {
          aggregate {
            count
          }
       }
      }`;

    const fetchResponse =
      await this.graphQLClient.request<GraphQlListCertificationsResponse>(
        fetchRequest,
      );

    return {
      certifications: fetchResponse.dionysus_certifications.map((result) =>
        toDomainObject(result),
      ),
      count: fetchResponse.dionysus_certifications_aggregate.aggregate.count,
    };
  }
}
