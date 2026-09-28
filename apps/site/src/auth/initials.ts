/**
 * Up to two initials, for an avatar with no picture behind it.
 *
 * The API's `CurrentUser` is an id, a display name, an email address and roles.
 * The avatar that used to be here was the identity provider's, handed over by
 * NextAuth along with the session; this API's directory has no equivalent, and
 * inventing one from an email address is a worse guess than two letters.
 */
export const initials = (displayName: string | undefined): string => {
  const words = (displayName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = (words.length === 1 ? words : [words[0]!, words.at(-1)!]).map(
    (word) => word[0]!,
  );
  return letters.join("").toUpperCase();
};
