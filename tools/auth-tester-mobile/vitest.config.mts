import node from "@ncfritz/olympus-config/vitest/node";

// Only the parts with no React Native in them are unit-tested: resolving a
// target to a base URL, and deriving storage keys. Anything that needs a
// device is a sign-off step in the plan, not a test.
export default node;
