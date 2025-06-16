export interface ProductionCompanyParent {
  id: number;
  name: string;
  logo_path: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  description: string;
  headquarters: string;
  homepage: string;
  logo_path: string;
  origin_country: string;
  parent_company?: ProductionCompanyParent;
}

export interface AlternativeName {
  name: string;
  type: string;
}

export interface AlternativeNames {
  id: number;
  results: AlternativeName[];
}

interface Logo {
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
  logos: Logo[];
}
