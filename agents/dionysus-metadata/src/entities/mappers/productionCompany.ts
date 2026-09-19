import type {
  PartialAlternativeName,
  PartialIdentifiableImage,
  PartialProductionCompany,
} from "@ncfritz/olympus-sdk/dionysus";
import type { TmdbClient } from "../../tmdb/services/TmdbClient";

/** Maps TMDB's responses for a production company to the API entity. */
export const toProductionCompany = (
  companyResponse: Awaited<
    ReturnType<TmdbClient["getProductionCompanyDetails"]>
  >,
  alternativeNamesResponse: Awaited<
    ReturnType<TmdbClient["getProductionCompanyAlternativeNames"]>
  >,
  imagesResponse: Awaited<ReturnType<TmdbClient["getProductionCompanyImages"]>>,
): PartialProductionCompany => {
  const alternativeNames: PartialAlternativeName[] = [];

  alternativeNamesResponse.results.forEach((value) => {
    const candidate = {
      name: value.name,
      type: value.type,
    };

    if (
      !alternativeNames.some(
        (e) => e.name === candidate.name && e.type === value.type,
      )
    ) {
      alternativeNames.push(candidate);
    }
  });

  const logos: PartialIdentifiableImage[] = [];

  imagesResponse.logos.forEach((value) => {
    logos.push({
      //productionCompanyId: companyResponse.id,
      id: value.id,
      fileType: value.file_type,
      filePath: value.file_path,
      width: value.width,
      height: value.height,
    });
  });

  let parentCompanyId: number | undefined = undefined;

  if (companyResponse.parent_company) {
    parentCompanyId = companyResponse.parent_company.id;
  }

  const company: PartialProductionCompany = {
    id: companyResponse.id,
    name: companyResponse.name,
    description: companyResponse.description,
    headquarters: companyResponse.headquarters,
    homepage: companyResponse.homepage,
    logoPath: companyResponse.logo_path,
    originCountry: companyResponse.origin_country,
    parentCompanyId: parentCompanyId,
    alternativeNames: alternativeNames,
    logos: logos,
  };

  return company;
};
