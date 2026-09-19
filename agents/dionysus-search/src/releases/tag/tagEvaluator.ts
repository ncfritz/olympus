import { Logger } from "@nestjs/common";
import { QualityModel } from "../types";
import { TagDefinition, TagResult, TagSource } from "./types";

const logger = new Logger("TagEvaluator");

export const evaluate = (
  input: QualityModel,
  definition: TagDefinition,
): TagResult | undefined => {
  logger.debug(`Evaluating tag ${definition.name}`);
  let anyMatch = false;

  for (let i = 0; i < definition.specifications.length; i++) {
    const spec = definition.specifications[i];

    let result = false;

    if (spec.implementation === TagSource.LanguageSpecification) {
      // Not implemented
      return;
    } else if (spec.implementation === TagSource.QualityModifierSpecification) {
      result =
        input.quality.modifier === (spec.fields.value as unknown as number);
    } else if (spec.implementation === TagSource.ReleaseGroupSpecification) {
      const re = new RegExp(spec.fields.value as unknown as string, "i");
      result = re.test(input.quality.group);
    } else if (spec.implementation === TagSource.ReleaseTitleSpecification) {
      const re = new RegExp(spec.fields.value as unknown as string, "i");
      result = re.test(input.title);
    } else if (spec.implementation === TagSource.ResolutionSpecification) {
      result =
        input.quality.resolution === (spec.fields.value as unknown as number);
    } else if (spec.implementation === TagSource.SourceSpecification) {
      result =
        input.quality.source === (spec.fields.value as unknown as number);
    }

    logger.debug(
      `  Evaluation: [required=${spec.required}][negate=${spec.negate}][result=${result}] - ${spec.name}`,
    );

    if (
      spec.required &&
      ((spec.negate && result) || (!spec.negate && !result))
    ) {
      logger.debug("  Bailing on evaluation, required condition not met!");
      return;
    }

    if (
      (spec.implementation === TagSource.ReleaseTitleSpecification ||
        spec.implementation === TagSource.ReleaseGroupSpecification) &&
      !spec.negate &&
      result
    ) {
      anyMatch = true;
    }
  }

  if (!anyMatch) {
    logger.debug(`Final evaluation: ${anyMatch}`);
    return;
  }

  return {
    name: definition.name,
    value: definition.trash_scores?.default || 0,
  };
};
