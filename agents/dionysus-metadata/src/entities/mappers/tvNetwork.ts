import type {
  PartialAlternativeName,
  PartialIdentifiableImage,
  PartialNetwork,
} from "@ncfritz/olympus-sdk/dionysus";
import type { TmdbClient } from "../../tmdb/services/TmdbClient";

/** Maps TMDB's responses for a TV network to the API entity. */
export const toTvNetwork = (
  networkResponse: Awaited<ReturnType<TmdbClient["getNetworkDetails"]>>,
  alternativeNamesResponse: Awaited<
    ReturnType<TmdbClient["getNetworkAlternativeNames"]>
  >,
  imagesResponse: Awaited<ReturnType<TmdbClient["getNetworkImages"]>>,
): PartialNetwork => {
  const alternativeNames: PartialAlternativeName[] = [];

  alternativeNamesResponse.results.forEach((value) => {
    alternativeNames.push({
      name: value.name,
      type: value.type,
    });
  });

  const images: PartialIdentifiableImage[] = [];

  imagesResponse.logos.forEach((value) => {
    images.push({
      id: value.id,
      fileType: value.file_type,
      filePath: value.file_path,
      width: value.width,
      height: value.height,
    });
  });

  const network: PartialNetwork = {
    id: networkResponse.id,
    name: networkResponse.name,
    headquarters: networkResponse.headquarters,
    homepage: networkResponse.homepage,
    logoPath: networkResponse.logo_path,
    originCountry: networkResponse.origin_country,
    alternativeNames: alternativeNames,
    images: images,
  };

  return network;
};
