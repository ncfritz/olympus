import { Logger } from "@nestjs/common";
import { QualityModel } from "../types";
import { TagDefinition, TagResult, TagSource, TagSpecification } from "./types";

const logger = new Logger("TagEvaluator");

/** Whether the release meets one condition, before `negate`. */
const test = (input: QualityModel, spec: TagSpecification): boolean => {
  const value = spec.fields.value;

  switch (spec.implementation) {
    case TagSource.QualityModifierSpecification:
      return input.quality.modifier === Number(value);
    case TagSource.ReleaseGroupSpecification:
      // No group, no match (so a negated "." means "no group").
      return (
        input.releaseGroup !== undefined &&
        new RegExp(String(value), "i").test(input.releaseGroup)
      );
    case TagSource.ReleaseTitleSpecification:
      return new RegExp(String(value), "i").test(input.title);
    case TagSource.ResolutionSpecification:
      return input.quality.resolution === Number(value);
    case TagSource.SourceSpecification:
      return input.quality.source === Number(value);
    default:
      return false;
  }
};

/**
 * Evaluates a custom format (tag) as Radarr does: its conditions are
 * grouped by type; every group needs at least one condition met, and every
 * required condition must be met. `negate` inverts a condition. Formats
 * with conditions this evaluator can't check (languages) never match.
 */
export const evaluate = (
  input: QualityModel,
  definition: TagDefinition,
): TagResult | undefined => {
  const groups = new Map<TagSource, { met: boolean; required: boolean }[]>();

  for (const spec of definition.specifications) {
    if (spec.implementation === TagSource.LanguageSpecification) {
      // Not implemented
      return;
    }

    const met = test(input, spec) !== spec.negate;
    const group = groups.get(spec.implementation) ?? [];
    group.push({ met, required: spec.required });
    groups.set(spec.implementation, group);
  }

  const matches = [...groups.values()].every(
    (group) =>
      group.some((condition) => condition.met) &&
      group.every((condition) => condition.met || !condition.required),
  );

  logger.debug(`Tag ${definition.name}: ${matches ? "matches" : "no match"}`);

  if (!matches || groups.size === 0) {
    return;
  }

  return {
    name: definition.name,
    value: definition.trash_scores?.default || 0,
  };
};
