export enum TagSource {
  LanguageSpecification = "LanguageSpecification",
  QualityModifierSpecification = "QualityModifierSpecification",
  ReleaseGroupSpecification = "ReleaseGroupSpecification",
  ReleaseTitleSpecification = "ReleaseTitleSpecification",
  ResolutionSpecification = "ResolutionSpecification",
  SourceSpecification = "SourceSpecification",
}

export type TagDefinition = {
  trash_id: string;
  trash_scores?: {
    default?: number;
  };
  name: string;
  specifications: TagSpecification[];
};

export type TagSpecification = {
  name: string;
  implementation: TagSource;
  negate: boolean;
  required: boolean;
  fields: {
    value: string | number;
  };
};

export type TagResult = {
  name: string;
  value: number;
};
