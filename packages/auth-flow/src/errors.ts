/**
 * A sign-in that cannot go on: a grant the API refused, a token that is not
 * one, a rotation that came back without the tokens it promised.
 *
 * Its own class rather than `Error` so a caller can tell "the flow says no"
 * from "something in here is broken", and print the first as a sentence
 * without swallowing the second.
 */
export class AuthFlowError extends Error {}
