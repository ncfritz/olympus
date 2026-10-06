import { BadRequestException } from "@nestjs/common";

/** Every named field a non-empty string of at most 4,096 characters. */
export const requireSignIn = (request: unknown, fields: string[]): void => {
  const body = (request ?? {}) as Record<string, unknown>;
  const problems = fields.filter(
    (f) =>
      typeof body[f] !== "string" ||
      (body[f] as string).length < 1 ||
      (body[f] as string).length > 4096,
  );
  if (problems.length) {
    throw new BadRequestException(
      problems.map((f) => `${f} must be a non-empty string`),
    );
  }
};
