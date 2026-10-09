const DECIMAL = /^\d{1,20}$/;

/**
 * Takeout writes Gmail's message and thread IDs in decimal (the separator,
 * `X-GM-THRID`); the API writes the same numbers in hexadecimal.
 */
export const decimalToGmailId = (decimal: string): string => {
  const trimmed = decimal.trim();
  if (!DECIMAL.test(trimmed)) {
    throw new RangeError(`Not a decimal Gmail ID: "${decimal}"`);
  }
  return BigInt(trimmed).toString(16);
};
