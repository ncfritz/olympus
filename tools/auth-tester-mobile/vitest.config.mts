import node from "@ncfritz/olympus-config/vitest/node";

// Only the parts with no React Native in them are unit-tested: resolving a
// target to a base URL, deriving storage keys, holding a session, translating
// an axios request for the native transport, and turning a call into a line.
// Anything that needs a device is a sign-off step in the plan, not a test.
// `test/unit/boundary.spec.ts` is what keeps that line where it is.
export default node;
