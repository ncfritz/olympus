/**
 * Something the person running the tester can do something about: a missing
 * flag, an API that refused, tokens that have run out. Printed as a sentence
 * with no stack trace, because the stack of a CLI argument mistake is noise.
 *
 * Anything else -- a connection refused, a bug in here -- prints in full,
 * where the detail is the only clue.
 */
export class TesterError extends Error {}
