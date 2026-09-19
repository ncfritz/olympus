export interface Network {
  id: number;
  name: string;
  headquarters: string;
  homepage: string;
  logo_path: string;
  origin_country: string;
}

export interface AlternativeName {
  name: string;
  type: string;
}

export interface AlternativeNames {
  id: number;
  results: AlternativeName[];
}

interface Image {
  id: string;
  file_type: string;
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_count: number;
  vote_average: number;
}

export interface Images {
  id: number;
  logos: Image[];
}
